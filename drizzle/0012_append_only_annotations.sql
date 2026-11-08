CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON proposal_annotations FOR EACH ROW EXECUTE FUNCTION reject_mutation();
