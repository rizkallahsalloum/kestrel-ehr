-- 0012 audit vocabulary for Phase 9 chart records: diagnosis status changes and
-- edits, and encounter note saves. Metadata stays content-free (ids and versions).

alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add constraint audit_logs_action_check check (action in (
  'prescription.created',
  'prescription.updated',
  'prescription.evaluated',
  'alert.acknowledged',
  'prescription.signed',
  'prescription.cancelled',
  'patient.team_assigned',
  'care_team.member_added',
  'care_team.member_removed',
  'patient_chart.viewed',
  'diagnosis.resolved',
  'diagnosis.reopened',
  'diagnosis.updated',
  'encounter_note.created',
  'encounter_note.updated'
));

alter table private.audit_logs drop constraint audit_logs_entity_type_check;
alter table private.audit_logs add constraint audit_logs_entity_type_check check (entity_type in (
  'prescription', 'prescription_alert', 'patient', 'care_team', 'diagnosis', 'encounter_note'
));
