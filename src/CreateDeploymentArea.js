import React, { Component } from "react";
import {
  Button,
  Layout,
  Col,
  Row,
  Table,
  Badge,
  Select,
  Steps,
  message,
  Input,
  Checkbox,
} from "antd";
import ReactJson from "react-json-view";
import winston_logger from "./logger.js";
import { GlobalContext } from "./GlobalContext.js";
import { Thing } from "sintef-ditto-javascript-client-dom";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-powershell.js";
import "prismjs/themes/prism.css"; //Example style, you can use another
import { DITTO_NAMESPACE } from "./config";
import { deployTrustAgent, findMatchingDevices } from "./dittoActions";

const logger = winston_logger.child({ source: "CreateDeploymentArea.js" });

const { Content } = Layout;
const { Option } = Select;
const { Step } = Steps;

export class CreateDeploymentArea extends Component {
  static contextType = GlobalContext;

  constructor(props) {
    super(props);
    this.columns = [
      {
        title: "Device ID",
        dataIndex: "_thingId",
        align: "left",
        render: (text, record) => (
          <span>
            <Badge
              status={
                record._attributes.type === "physical_device"
                  ? "processing"
                  : "default"
              }
            />
            {record._thingId}
          </span>
        ),
      },
    ];
    this.state = {
      current: 0,
      save: false,
      deployment_name: "",
      current_agent: null,
      new_deployment: require("./resources/deployment_template.json"),
      matching_devices: [],
      new_assignment_json: require("./resources/cps_assignment_template.json"),
      rql: "and(eq(features/cyber/properties/trustAgent/container_image,'rdautov/trust-agent'),eq(features/cyber/properties/trustAgent/container_version,'0.1'))",
    };
    this.editor = React.createRef();
  }

  handleDeploy = () => {
    this.state.matching_devices.forEach((device) => {
      deployTrustAgent(
        this.context.ditto_client,
        device.thingId,
        this.state.current_agent
      );
    });
    if (this.state.save && this.state.deployment_name !== "") {
      this.saveDeployment();
    }
    message.success("Deployment complete!");
    this.setState({
      current: 0,
      deployment_name: "",
      current_agent: null,
      matching_devices: [],
      save: false,
    });
  };

  saveDeployment = () => {
    let json = this.state.new_deployment;
    json.thingId = DITTO_NAMESPACE + ":" + this.state.deployment_name;
    json.attributes.trust_agent_id = this.state.current_agent._thingId;
    json.attributes.rql_expression = this.state.rql;

    let deployment = Thing.fromObject(json);

    const thingsHandle = this.context.ditto_client.getThingsHandle();
    thingsHandle
      .putThing(deployment)
      .then((result) =>
        logger.info(
          `Finished putting the new deployment with the result: ${JSON.stringify(
            result
          )}`
        )
      )
      .catch((e) =>
        logger.error("Failed to save the deployment: " + e.message)
      );
  };

  render() {
    const { current, rql } = this.state;

    const steps = [
      {
        title: "Select software/firmware",
        content: (
          <>
            <Select
              style={{ width: "100%" }}
              onSelect={this.handleDropdownChange}
            >
              {this.context.trust_agents.map((item) => (
                <Option key={item._thingId} value={JSON.stringify(item)}>
                  {item._thingId}
                </Option>
              ))}
            </Select>
            <ReactJson
              src={
                this.state.current_agent === null
                  ? {}
                  : this.state.current_agent
              }
            />
          </>
        ),
      },
      {
        title: "Define target conditions",
        content: (
          <Editor
            value={rql}
            onValueChange={(code) => this.handleTypeChanges(code)}
            highlight={(code) => highlight(code, languages.powershell)}
            padding={10}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontWeight: "bold",
            }}
          />
        ),
      },
      {
        title: "Confirm matching devices",
        content: (
          <Table
            rowKey={(record) => record.id}
            size="small"
            dataSource={this.state.matching_devices}
            columns={this.columns}
            pagination={{ pageSize: 50 }}
            expandedRowRender={(record) => (
              <ReactJson src={record} enableClipboard={false} collapsed="1" />
            )}
          />
        ),
      },
    ];

    return (
      <Layout>
        <Content>
          <Row>
            <Col
              style={{
                marginTop: 16,
                marginBottom: 16,
                marginLeft: 24,
                marginRight: 24,
              }}
            >
              <Steps current={current}>
                {steps.map((item) => (
                  <Step key={item.title} title={item.title} />
                ))}
              </Steps>
              <div className="steps-content">{steps[current].content}</div>
              <div
                className="steps-action"
                style={{ display: "flex", justifyContent: "center" }}
              >
                {current < steps.length - 1 && (
                  <Button
                    type="primary"
                    disabled={!this.state.current_agent}
                    onClick={() => this.next()}
                  >
                    Next
                  </Button>
                )}
                {current === steps.length - 1 && (
                  <Button type="primary" onClick={this.handleDeploy}>
                    Deploy
                  </Button>
                )}
                {current > 0 && (
                  <Button style={{ marginLeft: 8 }} onClick={() => this.prev()}>
                    Previous
                  </Button>
                )}
              </div>
              <div
                className="save-action"
                style={{ display: "flex", justifyContent: "center" }}
              >
                {current === steps.length - 1 && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Checkbox onChange={this.onCheckboxChange}>
                      Save deployment
                    </Checkbox>
                    <Input
                      placeholder="Deployment name"
                      onChange={this.onDeploymentNameChange}
                      disabled={!this.state.save}
                    ></Input>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Content>
      </Layout>
    );
  }

  handleTypeChanges = (value) => {
    this.setState({ rql: value });
  };

  onCheckboxChange = (e) => {
    this.setState({ save: e.target.checked });
  };

  onDeploymentNameChange = (e) => {
    this.setState({ deployment_name: e.target.value });
  };

  next() {
    const current = this.state.current + 1;
    if (current === 2) {
      logger.debug("RQL query is: " + this.state.rql);
      findMatchingDevices(this.context.ditto_client, this.state.rql)
        .then((result) => this.setState({ matching_devices: result }))
        .catch((e) =>
          logger.error("Failed to find matching devices: " + e.message)
        );
    }
    this.setState({ current });
    logger.info("Next", current);
  }

  prev() {
    const current = this.state.current - 1;
    this.setState({ current });
    logger.info("Prev", current);
  }

  handleDropdownChange = (value) => {
    this.setState({ current_agent: JSON.parse(value) });
  };
}
