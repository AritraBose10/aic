import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { v1 } from "@google-cloud/firestore";

/**
 * NFR-10 — scheduled Firestore backup/export to Google Cloud Storage.
 *
 * RPO (Recovery Point Objective): 24h — a daily managed export means at most
 *   ~24h of writes could be lost in a disaster.
 * RTO (Recovery Time Objective): ~2h — restore via `gcloud firestore import`
 *   from the latest export prefix (documented in DEPLOYMENT.md at cutover).
 *
 * DEPENDENCY (Blaze): Cloud Scheduler + Cloud Functions + a GCS bucket + the
 * Firestore managed-export API all require the Blaze plan. This is the SAME
 * billing wall as the AI/functions cutover. The logic is built here; it is NOT
 * deployed or scheduled. At cutover: provision the bucket
 * `gs://<projectId>-firestore-backups` with a lifecycle rule (e.g. keep 30 days),
 * grant the Functions service account `roles/datastore.importExportAdmin`, then
 * deploy. NO bucket name or credential is hard-coded here.
 */

const adminClient = new v1.FirestoreAdminClient();

export const scheduledFirestoreBackup = onSchedule("every 24 hours", async () => {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  if (!projectId) {
    logger.error("scheduledFirestoreBackup: project id unavailable; aborting.");
    return;
  }
  // Convention-based bucket — provision at cutover; never a hard-coded secret.
  const outputUriPrefix = `gs://${projectId}-firestore-backups`;
  const databaseName = adminClient.databasePath(projectId, "(default)");

  const [response] = await adminClient.exportDocuments({
    name: databaseName,
    outputUriPrefix,
    collectionIds: [], // [] = all collections
  });
  logger.info(`Firestore export started: ${response.name}`);
});
