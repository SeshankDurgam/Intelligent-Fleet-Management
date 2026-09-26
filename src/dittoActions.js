// Shared Ditto operations used by the area components.
// Helpers take the ditto_client (from GlobalContext) as their first argument.

import { DefaultSearchOptions } from "sintef-ditto-javascript-client-dom";
import winston_logger from "./logger.js";

const logger = winston_logger.child({ source: "dittoActions.js" });

/**
 * Build the desired-property payload announcing a trust agent on a device,
 * or null when the agent type is not deployable.
 */
export function buildTrustAgentProperty(agent) {
  if (agent._attributes.type === "trust_agent_docker") {
    return {
      container_image: agent._attributes.image,
      container_version: agent._attributes.version,
      container_status: "running",
      ta_meta: agent._attributes,
    };
  }
  if (agent._attributes.type === "trust_agent_ssh") {
    return {
      process_name: "trust-agent.sh",
      process_status: "running",
      ta_meta: agent._attributes,
    };
  }
  //FIXME: what if a device has both docker and ssh?
  return null;
}

/**
 * Deploy a trust agent (docker or ssh) to a device twin by setting the
 * desired 'trustAgent' property, which the backend forwards downstream.
 */
export function deployTrustAgent(ditto_client, thingId, agent) {
  const trust_agent = buildTrustAgentProperty(agent);
  if (trust_agent === null) {
    logger.info(thingId + " is not suitable for " + agent._thingId);
    return Promise.resolve();
  }
  const featuresHandle = ditto_client.getFeaturesHandle(thingId);
  return featuresHandle
    .putDesiredProperty("cyber", "trustAgent", trust_agent)
    .then((result) =>
      logger.info(
        `${thingId}: finished updating the device twin with result: ${JSON.stringify(
          result
        )}`
      )
    )
    .catch((e) =>
      logger.error(`${thingId}: failed to update the device twin: ${e.message}`)
    );
}

/** Find devices matching an RQL expression. */
export async function findMatchingDevices(ditto_client, rqlExpression) {
  const searchHandle = ditto_client.getSearchHandle();
  const options = DefaultSearchOptions.getInstance()
    .withFilter(rqlExpression)
    .withSort("+thingId")
    .withLimit(0, 200);
  const devices = (await searchHandle.search(options)).items;
  logger.debug("Found matching devices: " + JSON.stringify(devices));
  return devices;
}

/** Delete a single twin by id; 'kind' is only used for log messages. */
export function deleteThing(ditto_client, thingId, kind = "twin") {
  const thingsHandle = ditto_client.getThingsHandle();
  return thingsHandle
    .deleteThing(thingId)
    .then((result) =>
      logger.info(
        `Finished deleting the ${kind} ${thingId} with result: ${JSON.stringify(
          result
        )}`
      )
    )
    .catch((e) =>
      logger.error(`Failed to delete ${kind} ${thingId}: ${e.message}`)
    );
}
