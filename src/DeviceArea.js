import React, { Component } from "react";
import {
  Button,
  Layout,
  Col,
  Row,
  Table,
  Tooltip,
  Modal,
  Select,
  Popconfirm,
  Switch,
} from "antd";
import ReactJson from "react-json-view";
import { GlobalContext } from "./GlobalContext";
import { Thing } from "sintef-ditto-javascript-client-dom";
import { JsonEditor as Editor } from "jsoneditor-react";
import "jsoneditor-react/es/editor.min.css";
import winston_logger from "./logger.js";
import { deployTrustAgent as deployTrustAgentAction, deleteThing } from "./dittoActions";

const logger = winston_logger.child({ source: "DeviceArea.js" });

const { Content } = Layout;
const ButtonGroup = Button.Group;
const { Option } = Select;

export class DeviceArea extends Component {
  static contextType = GlobalContext;

  constructor(props) {
    super(props);
    this.columns = [
      {
        title: "Device ID",
        dataIndex: "_thingId",
        align: "left",
        render: (text, record) => <span>{record._thingId}</span>,
      },
      {
        title: "Actions",
        width: 150,
        align: "right",
        render: (text, record) => (
          <span style={{ float: "center" }}>
            <ButtonGroup size="small" type="dashed">
              <Tooltip title="Deploy software">
                <Button
                  type="primary"
                  icon="plus-circle"
                  onClick={() =>
                    Modal.confirm({
                      title: "Deploy software",
                      content: (
                        <Select
                          style={{ width: "100%" }}
                          align="middle"
                          onSelect={(value, event) =>
                            this.handleDropdownChange(value, event)
                          }
                        >
                          {this.context.trust_agents.map((item) => (
                            <Option
                              key={item._thingId}
                              value={JSON.stringify(item)}
                            >
                              {item._thingId}
                            </Option>
                          ))}
                        </Select>
                      ),
                      onOk: () => {
                        this.deployTrustAgent(
                          this.state.active_device._thingId,
                          this.state.trust_agent
                        );
                      },
                      onCancel: () => {
                        this.handleCancelEdit();
                      },
                    })
                  }
                  ghost
                />
              </Tooltip>
              <Tooltip title="Undeploy software">
                <Popconfirm
                  title={"Undeploy software on: " + record.id}
                  onConfirm={() => this.undeployTrustAgent(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" icon="minus-circle" ghost />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Delete device twin">
                <Popconfirm
                  title={"Delete device twin: " + record.id}
                  onConfirm={() => this.deleteDeviceTwin(record.id)}
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
      trust_agent: { value: "" },
      active_device: "",
      new_device: require("./resources/cps_device_template.json"),
      simulation: false,
    };
  }

  handleDropdownChange = (value, event) => {
    logger.info("value: " + value);
    this.setState({ trust_agent: JSON.parse(value) });
  };

  handleCancelEdit = (e) => {
    logger.info(e);
  };

  handleNewTwinChange = (value) => {
    this.setState({ new_device: value });
  };

  handleSimulationSwitchChange = (value) => {
    logger.info(value);
    this.setState({ simulation: value });
  };

  render() {
    return (
      <Layout>
        <Content>
          <Row>
            <Col flex="auto" justify="end" align="right">
              <Switch
                checkedChildren="Sim"
                unCheckedChildren="Phy"
                style={{
                  marginTop: 22,
                  marginBottom: 10,
                  marginLeft: 24,
                  float: "left",
                }}
                onChange={this.handleSimulationSwitchChange}
              />
              <Button
                type="primary"
                style={{ marginTop: 16, marginBottom: 16, marginRight: 16 }}
                onClick={() =>
                  Modal.confirm({
                    title: "Create a new device twin",
                    width: 800,
                    height: 800,
                    content: (
                      <Editor
                        value={this.state.new_device}
                        onChange={this.handleNewTwinChange}
                      />
                    ),
                    onOk: () => {
                      this.createDeviceTwin(this.state.new_device);
                    },
                    onCancel: () => {
                      this.handleCancelEdit();
                    },
                  })
                }
              >
                New device twin
              </Button>
              <Popconfirm
                title="Delete all device twins?"
                onConfirm={this.deleteAllTwins}
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
              <Button
                type="primary"
                style={{ marginTop: 16, marginBottom: 16, marginRight: 16 }}
                onClick={() =>
                  Modal.confirm({
                    title: "Recover a digital twin from DLT",
                    content: (
                      <Select style={{ width: "100%" }} align="middle">
                        <Option key="key" value="value">
                          no.sintef.sct.giot:tellu-rpm-gateway-001
                        </Option>
                      </Select>
                    ),
                    onOk: () => {},
                    onCancel: () => {
                      this.handleCancelEdit();
                    },
                  })
                }
              >
                Recover device twin
              </Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <Table
                rowKey={(record) => record.id}
                size="small"
                dataSource={
                  this.state.simulation
                    ? this.context.devices
                    : this.context.physical_devices
                }
                columns={this.columns}
                pagination={{ pageSize: 20 }}
                onRow={(record) => {
                  return {
                    onClick: (event) => {
                      this.setState({ active_device: record });
                    }, // click row
                  };
                }}
                expandedRowRender={(record) => (
                  <ReactJson
                    src={record}
                    enableClipboard={false}
                    collapsed="1"
                  />
                )}
              />
            </Col>
          </Row>
        </Content>
      </Layout>
    );
  }

  createDeviceTwin = async () => {
    logger.info(this.state.new_device);
    var device = Thing.fromObject(this.state.new_device);
    const thingsHandle = this.context.ditto_client.getThingsHandle();
    thingsHandle
      .putThing(device)
      .then((result) =>
        logger.info(
          `Finished putting the new device twin with the result: ${JSON.stringify(
            result
          )}`
        )
      )
      .catch((e) =>
        logger.error("Failed to create the device twin: " + e.message)
      );
  };

  deleteDeviceTwin = async (thingId) => {
    return deleteThing(this.context.ditto_client, thingId, "device twin");
  };

  deleteAllTwins = async () => {
    this.context.devices.forEach((device) => {
      this.deleteDeviceTwin(device.id);
    });
  };

  undeployTrustAgent = async (thingId) => {
    logger.debug("Undeploying agent on: " + thingId);
    const featuresHandle = this.context.ditto_client.getFeaturesHandle(thingId);
    featuresHandle
      .putDesiredProperty("cyber", "trustAgent", {})
      .then((result) =>
        logger.info(
          `Finished updating the device twin with result: ${JSON.stringify(
            result
          )}`
        )
      )
      .catch((e) =>
        logger.error("Failed to undeploy the trust agent: " + e.message)
      );
  };

  deployTrustAgent = async (thingId, desired_agent) => {
    //TODO: how to pass the meta information about the trust agent?
    logger.debug("Desired agent: " + desired_agent);
    return deployTrustAgentAction(
      this.context.ditto_client,
      thingId,
      desired_agent
    );
  };
}
