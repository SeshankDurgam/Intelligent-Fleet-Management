// logging.js
// Reusable timestamp logging utility for NodeJS

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default log file inside the container (mount a volume to access on host)
export const DEFAULT_LOG_FILE = "./logs/timestamps.csv";

/**
 * Append a structured timestamp entry into a CSV log file.
 *
 * CSV format:
 *   workflowId,step,event,timestamp,nodeId
 *
 * @param {Object} opts
 * @param {string} opts.workflowId - Unique workflow or experiment run ID
 * @param {string} opts.step - Name of the workflow step
 * @param {string} opts.event - "start" or "end"
 * @param {string} [opts.nodeId] - Device / container hostname
 * @param {string} [opts.file] - Optional custom logfile path
 */
export function logTimestamp({ workflowId, step, event, nodeId = os.hostname(), file = DEFAULT_LOG_FILE }) {
  const timestamp = Date.now();
  const timestampISO = new Date().toISOString()
  const line = `${workflowId},${step},${event},${timestamp},${nodeId}${os.EOL}`;
  const filePath = path.resolve(file);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(filePath, line, "utf8");
  console.log("Timestamp logged at " + timestampISO, line.trim());
}

/**
 * Append a structured timestamp entry into the console in browser.
 *
 * CSV format:
 *   workflowId,step,event,timestamp,nodeId
 *
 * @param {Object} opts
 * @param {string} opts.workflowId - Unique workflow or experiment run ID
 * @param {string} opts.step - Name of the workflow step
 * @param {string} opts.event - "start" or "end"
 * @param {string} [opts.nodeId] - Device / container hostname
 */
export function logTimestampJS({ workflowId, step, event, nodeId = os.hostname() }) {
  const timestamp = Date.now();
  const timestampISO = new Date().toISOString()
  const line = `${workflowId},${step},${event},${timestamp},${nodeId}${os.EOL}`;
  //const filePath = path.resolve(file);

  // Ensure directory exists
  //const dir = path.dirname(filePath);
  //if (!fs.existsSync(dir)) {
  //  fs.mkdirSync(dir, { recursive: true });
  //}

  //fs.appendFileSync(filePath, line, "utf8");
  console.log("Timestamp logged at " + timestampISO);
  console.log(line.trim());
}

//module.exports = {
//  logTimestamp,
//  logTimestampJS,
//  DEFAULT_LOG_FILE
//};
