-- 0009 prescription functions: the only paths that evaluate safety rules,
-- record acknowledgements, sign, or cancel. Each locks the prescription row,
-- re-checks the caller, and runs in a single transaction.

-- Locks a draft and verifies the caller is its prescriber on the patient's team.
-- Non-members get "not found" so the function does not reveal that a record exists.
create or replace function private.lock_own_draft(p_prescription_id uuid)
returns public.prescriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rx public.prescriptions;
begin
  select * into v_rx from public.prescriptions where id = p_prescription_id for update;
  if not found or not private.is_care_team_member(v_rx.patient_id) then
    raise exception 'Prescription not found' using errcode = 'no_data_found';
  end if;
  if not private.is_clinician() or v_rx.prescriber_id <> auth.uid() then
    raise exception 'Only the prescriber can change this prescription' using errcode = 'insufficient_privilege';
  end if;
  if v_rx.status <> 'draft' then
    raise exception 'Prescription is no longer a draft' using errcode = 'KE001';
  end if;
  return v_rx;
end;
$$;

revoke all on function private.lock_own_draft(uuid) from public, anon, authenticated;

-- The illustrative rule engine. Matches on fictional drug classes only.
create or replace function private.compute_prescription_alerts(p_prescription_id uuid)
returns table (
  rule_id uuid,
  severity public.alert_severity,
  message text,
  allergy_id uuid,
  patient_medication_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.severity, r.message, a.id, null::uuid
  from public.prescriptions rx
  join public.medications m on m.id = rx.medication_id
  join public.interaction_rules r
    on r.is_active and r.rule_type = 'allergy_class' and r.class_a = m.drug_class_code
  join public.allergies a
    on a.patient_id = rx.patient_id and a.status = 'active' and a.drug_class_code = r.class_a
  where rx.id = p_prescription_id
  union all
  select r.id, r.severity, r.message, null::uuid, pm.id
  from public.prescriptions rx
  join public.medications m on m.id = rx.medication_id
  join public.interaction_rules r
    on r.is_active and r.rule_type = 'interaction_class' and m.drug_class_code in (r.class_a, r.class_b)
  join public.patient_medications pm
    on pm.patient_id = rx.patient_id and pm.status = 'active'
  join public.medications pmm
    on pmm.id = pm.medication_id
   and pmm.drug_class_code = case when m.drug_class_code = r.class_a then r.class_b else r.class_a end
  where rx.id = p_prescription_id;
$$;

revoke all on function private.compute_prescription_alerts(uuid) from public, anon, authenticated;

-- Materializes alerts for the current version, resolves alerts whose condition
-- disappeared, records the evaluated version, and returns the counts.
create or replace function private.run_prescription_evaluation(
  p_prescription_id uuid,
  out o_version integer,
  out o_blocking integer,
  out o_advisory_pending integer,
  out o_advisory_total integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
begin
  select rx.version, rx.patient_id into o_version, v_patient_id
  from public.prescriptions rx where rx.id = p_prescription_id;

  insert into public.prescription_alerts
    (prescription_id, prescription_version, rule_id, severity, message, allergy_id, patient_medication_id)
  select p_prescription_id, o_version, f.rule_id, f.severity, f.message, f.allergy_id, f.patient_medication_id
  from private.compute_prescription_alerts(p_prescription_id) f
  on conflict (prescription_id, prescription_version, rule_id, (coalesce(allergy_id, patient_medication_id)))
  do update set resolved_at = null;

  update public.prescription_alerts a
  set resolved_at = now()
  where a.prescription_id = p_prescription_id
    and a.prescription_version = o_version
    and a.resolved_at is null
    and not exists (
      select 1 from private.compute_prescription_alerts(p_prescription_id) f
      where f.rule_id = a.rule_id
        and f.allergy_id is not distinct from a.allergy_id
        and f.patient_medication_id is not distinct from a.patient_medication_id
    );

  update public.prescriptions set last_evaluated_version = o_version where id = p_prescription_id;

  select
    count(*) filter (where a.severity = 'blocking'),
    count(*) filter (where a.severity = 'advisory' and d.id is null),
    count(*) filter (where a.severity = 'advisory')
  into o_blocking, o_advisory_pending, o_advisory_total
  from public.prescription_alerts a
  left join public.prescription_safety_decisions d on d.alert_id = a.id
  where a.prescription_id = p_prescription_id
    and a.prescription_version = o_version
    and a.resolved_at is null;

  perform private.write_audit('prescription.evaluated', 'prescription', p_prescription_id, v_patient_id,
    jsonb_build_object('version', o_version, 'blocking', o_blocking, 'advisory', o_advisory_total));
end;
$$;

revoke all on function private.run_prescription_evaluation(uuid) from public, anon, authenticated;

create or replace function public.evaluate_prescription_safety(p_prescription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
begin
  perform private.lock_own_draft(p_prescription_id);
  select * into v_result from private.run_prescription_evaluation(p_prescription_id);
  return jsonb_build_object(
    'version', v_result.o_version,
    'blocking', v_result.o_blocking,
    'advisoryPending', v_result.o_advisory_pending,
    'advisoryTotal', v_result.o_advisory_total
  );
end;
$$;

create or replace function public.acknowledge_prescription_alert(p_alert_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert public.prescription_alerts;
  v_rx public.prescriptions;
  v_decision_id uuid;
begin
  select * into v_alert from public.prescription_alerts where id = p_alert_id;
  if not found then
    raise exception 'Alert not found' using errcode = 'no_data_found';
  end if;

  v_rx := private.lock_own_draft(v_alert.prescription_id);

  if v_alert.prescription_version <> v_rx.version or v_alert.resolved_at is not null then
    raise exception 'Alert is not active for the current draft version' using errcode = 'KE007';
  end if;
  if v_alert.severity <> 'advisory' then
    raise exception 'Blocking alerts cannot be acknowledged' using errcode = 'KE003';
  end if;

  insert into public.prescription_safety_decisions (alert_id, decided_by, reason)
  values (p_alert_id, auth.uid(), nullif(trim(p_reason), ''))
  on conflict (alert_id) do nothing
  returning id into v_decision_id;

  if v_decision_id is null then
    select d.id into v_decision_id from public.prescription_safety_decisions d where d.alert_id = p_alert_id;
  end if;
  return v_decision_id;
end;
$$;

create or replace function public.sign_prescription(p_prescription_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rx public.prescriptions;
  v_eval record;
  v_patient_medication_id uuid;
begin
  v_rx := private.lock_own_draft(p_prescription_id);

  if v_rx.version <> p_expected_version then
    raise exception 'Prescription changed since it was reviewed' using errcode = 'KE002';
  end if;

  if not exists (select 1 from public.medications m where m.id = v_rx.medication_id and m.is_active) then
    raise exception 'Medication is not active in the catalog' using errcode = 'KE006';
  end if;

  -- Re-evaluate inside this transaction so data that changed since the last
  -- check (for example a newly recorded allergy) is always considered.
  select * into v_eval from private.run_prescription_evaluation(p_prescription_id);
  if v_eval.o_blocking > 0 then
    raise exception 'A blocking demo alert is active' using errcode = 'KE003';
  end if;
  if v_eval.o_advisory_pending > 0 then
    raise exception 'Advisory demo alerts must be acknowledged' using errcode = 'KE004';
  end if;

  update public.prescriptions
  set status = 'signed', signed_by = auth.uid(), signed_at = now()
  where id = p_prescription_id;

  insert into public.patient_medications
    (patient_id, medication_id, status, dose_text, start_date, source_prescription_id, recorded_by)
  values (
    v_rx.patient_id,
    v_rx.medication_id,
    'active',
    left(format('%s %s %s %s', trim_scale(v_rx.dose_amount), v_rx.dose_unit, v_rx.route,
      replace(v_rx.frequency::text, '_', ' ')), 200),
    v_rx.start_date,
    v_rx.id,
    auth.uid()
  )
  returning id into v_patient_medication_id;

  return jsonb_build_object(
    'id', v_rx.id,
    'status', 'signed',
    'version', v_rx.version,
    'patientMedicationId', v_patient_medication_id
  );
end;
$$;

create or replace function public.cancel_prescription(
  p_prescription_id uuid,
  p_expected_version integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rx public.prescriptions;
begin
  v_rx := private.lock_own_draft(p_prescription_id);

  if v_rx.version <> p_expected_version then
    raise exception 'Prescription changed since it was reviewed' using errcode = 'KE002';
  end if;

  update public.prescriptions
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancel_reason = nullif(trim(p_reason), '')
  where id = p_prescription_id;

  return jsonb_build_object('id', v_rx.id, 'status', 'cancelled', 'version', v_rx.version);
end;
$$;

revoke all on function public.evaluate_prescription_safety(uuid) from public, anon;
revoke all on function public.acknowledge_prescription_alert(uuid, text) from public, anon;
revoke all on function public.sign_prescription(uuid, integer) from public, anon;
revoke all on function public.cancel_prescription(uuid, integer, text) from public, anon;
grant execute on function public.evaluate_prescription_safety(uuid) to authenticated;
grant execute on function public.acknowledge_prescription_alert(uuid, text) to authenticated;
grant execute on function public.sign_prescription(uuid, integer) to authenticated;
grant execute on function public.cancel_prescription(uuid, integer, text) to authenticated;
