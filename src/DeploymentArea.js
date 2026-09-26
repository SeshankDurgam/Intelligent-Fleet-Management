import React, { Component } from "react";
import {
  Button,
  Layout,
  Col,
  Row,
  Table,
  Badge,
  Tooltip,
  Popconfirm,
  message,
} from "antd";
import ReactJson from "react-json-view";
import winston_logger from "./logger.js";
import { GlobalContext } from "./GlobalContext";
import {
  deployTrustAgent,
  deleteThing,
  findMatchingDevices,
} from "./dittoActions";

const logger = winston_logger.child({ source: "DeploymentArea.js" });

const { Content } = Layout;
const ButtonGroup = Button.Group;

export class DeploymentArea extends Component {
  static contextType = GlobalContext;

  constructor(props) {
    super(props);
    this.columns = [
      {
        title: "Deployment ID",
        dataIndex: "_thingId",
        align: "left",
        render: (text, record) => (
          <span>
            <Badge status="success" />
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
              <Tooltip title="Enact deployment">
                <Popconfirm
                  title={"Enact deployment: " + record.id}
                  onConfirm={() => this.enactDeployment(record)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" icon="rocket" ghost />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Delete deployment">
                <Popconfirm
                  title={"Delete deployment: " + record.id}
                  onConfirm={() => this.deleteDeployment(record.id)}
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
      current: 0,
      matching_device: [],
    };
    this.editor = React.createRef();
  }

  render() {
    return (
      <Layout>
        <Content>
          <Row type="flex" justify="end">
            <Col>
              <Popconfirm
                title="Delete all deployments?"
                onConfirm={this.deleteAllDeployments}
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
                dataSource={this.context.deployments}
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

  /** Deletes selected deployment from Ditto */
  deleteDeployment = async (thingId) => {
    return deleteThing(this.context.ditto_client, thingId, "deployment");
  };

  /** Deletes all deployments from Ditto */
  deleteAllDeployments = async () => {
    this.context.deployments.forEach((deployment) => {
      this.deleteDeployment(deployment._thingId);
    });
  };

  /** Apply the selected deployment to matching devices */
  enactDeployment = async (deployment) => {
    logger.debug("Enacting deployment: " + deployment._thingId);
    findMatchingDevices(
      this.context.ditto_client,
      deployment._attributes.rql_expression
    )
      .then((result) =>
        this.handleDeploy(deployment._attributes.trust_agent_id, result)
      )
      .catch((e) =>
        logger.error("Failed to enact the deployment: " + e.message)
      );
    message.success("Deployment complete!");
  };

  /** Deploys the selected trust agent to the matching devices */
  handleDeploy = (trustAgentId, matchingDevices) => {
    let ta = this.context.trust_agents.find((x) => x._thingId === trustAgentId);
    matchingDevices.forEach((device) => {
      deployTrustAgent(this.context.ditto_client, device._thingId, ta);
    });
  };
}
