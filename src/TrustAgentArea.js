import React, { Component } from "react";
import {
  Button,
  Layout,
  Col,
  Row,
  Table,
  Tooltip,
  Badge,
  Modal,
  Popconfirm,
} from "antd";
import ReactJson from "react-json-view";
import { GlobalContext } from "./GlobalContext";
import { Thing } from "sintef-ditto-javascript-client-dom";
import { JsonEditor as Editor } from "jsoneditor-react";
import "jsoneditor-react/es/editor.min.css";
import winston_logger from "./logger.js";
import { deployTrustAgent, deleteThing } from "./dittoActions";

const logger = winston_logger.child({ source: "TrustAgentArea.js" });

const { Content } = Layout;
const ButtonGroup = Button.Group;

export class TrustAgentArea extends Component {
  static contextType = GlobalContext;

  constructor(props) {
    super(props);
    this.columns = [
      {
        title: "Software/firmware ID",
        dataIndex: "_thingId",
        align: "left",
        render: (text, record) => (
          <span>
            <Badge
              color={
                record._attributes.type === "trust_agent_docker"
                  ? "blue"
                  : "green"
              }
            />
            {record._thingId}
          </span>
        ),
      },
      {
        title: "Actions",
        width: 100,
        align: "center",
        render: (text, record) => (
          <span style={{ float: "center" }}>
            <ButtonGroup size="small" type="dashed">
              <Tooltip title="Deploy on all suitable devices">
                <Popconfirm
                  title={"Deploy on all devices: " + record.id}
                  onConfirm={() => this.assignTrustAgentToAll(record)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" icon="deployment-unit" ghost />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="De-register">
                <Popconfirm
                  title={"De-register software/firmware: " + record.id}
                  onConfirm={() => this.deleteTrustAgent(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" icon="delete" ghost />
                </Popconfirm>
              </Tooltip>
            </ButtonGroup>
          </span>
        ),
      },
    ];
    this.nestedColumns = [
      {
        title: "Active deployments",
        dataIndex: "id",
        render: (text, record) => (
          <Button
            type="link"
            icon="deployment-unit"
            onClick={() => this.context.handleTabChange("3")}
          >
            {record}
          </Button>
        ),
      },
    ];
    this.state = {
      new_trust_agent_docker: require("./resources/docker_agent_template.json"),
      new_trust_agent_ssh: require("./resources/ssh_agent_template.json"),
      new_trust_agent_json: "",
    };
    this.editor = React.createRef();
  }

  /** Handles the changes in the JSON editor when creating a new trust agent  */
  handleChange = (value) => {
    this.setState({ new_trust_agent_json: value });
  };

  render() {
    return (
      <Layout>
        <Content>
          <Row type="flex" justify="end">
            <Col>
              <Button
                type="primary"
                style={{ marginTop: 16, marginBottom: 16, marginRight: 16 }}
                onClick={() =>
                  Modal.confirm({
                    title: "Register new Docker-based software",
                    width: 800,
                    content: (
                      <Editor
                        value={this.state.new_trust_agent_docker}
                        onChange={this.handleChange}
                      />
                    ),
                    onOk: () => {
                      this.createTrustAgent(this.state.new_trust_agent_docker);
                    },
                    onCancel: () => {},
                  })
                }
              >
                New Docker-based software
              </Button>
              <Popconfirm
                title="Un-register all software?"
                onConfirm={this.deleteAllTrustAgents}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  type="danger"
                  style={{ marginTop: 16, marginBottom: 16, marginRight: 16 }}
                >
                  Delete all
                </Button>
              </Popconfirm>
            </Col>
          </Row>
          <Row>
            <Col>
              <Table
                rowKey={(record) => record.id}
                size="small"
                dataSource={this.context.trust_agents}
                columns={this.columns}
                pagination={{ pageSize: 50 }}
                expandedRowRender={(record) => (
                  <span>
                    <ReactJson src={record} enableClipboard={false} />
                  </span>
                )}
              />
            </Col>
          </Row>
        </Content>
      </Layout>
    );
  }

  /** Creates a new trust agent in Ditto */
  createTrustAgent = async () => {
    const trust_agent = Thing.fromObject(this.state.new_trust_agent_json);
    logger.debug("NEW TRUST AGENT: " + JSON.stringify(trust_agent));
    const thingsHandle = this.context.ditto_client.getThingsHandle();
    thingsHandle
      .putThing(trust_agent)
      .then((result) =>
        logger.info(
          `Finished putting the new trust agent with result: ${JSON.stringify(
            result
          )}`
        )
      )
      .catch((e) =>
        logger.error("Failed to create the trust agent: " + e.message)
      );
  };

  /** Deletes the selected trust agent from Ditto */
  deleteTrustAgent = async (trustAgentId) => {
    return deleteThing(this.context.ditto_client, trustAgentId, "trust agent");
  };

  /** Deletes all trust agents from Ditto */
  deleteAllTrustAgents = async () => {
    this.context.trust_agents.forEach((agent) => {
      this.deleteTrustAgent(agent.id);
    });
  };

  /** Deploys the selected trust agent to all suitable devices */
  assignTrustAgentToAll = async (trustAgent) => {
    //FIXME: there must be only one check whether the device is suitable
    this.context.devices.forEach((device) => {
      deployTrustAgent(this.context.ditto_client, device.thingId, trustAgent);
    });
  };
}
