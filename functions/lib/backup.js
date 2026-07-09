"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledFirestoreBackup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("@google-cloud/firestore");
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
const adminClient = new firestore_1.v1.FirestoreAdminClient();
exports.scheduledFirestoreBackup = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
    if (!projectId) {
        v2_1.logger.error("scheduledFirestoreBackup: project id unavailable; aborting.");
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
    v2_1.logger.info(`Firestore export started: ${response.name}`);
});
