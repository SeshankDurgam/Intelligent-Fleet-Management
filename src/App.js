import React, { Component } from "react";
import "./App.css";
import winston_logger from "./logger.js";
import { Layout, Tabs, Icon, Row, Col } from "antd";

import {
  DittoDomClient,
  DomHttpBasicAuth,
  DefaultSearchOptions,
} from "sintef-ditto-javascript-client-dom";

import { DeviceArea } from "./DeviceArea";
import { TrustAgentArea } from "./TrustAgentArea";
import { DeploymentArea } from "./DeploymentArea";
import { CreateDeploymentArea } from "./CreateDeploymentArea.js";
import { GlobalContext } from "./GlobalContext";
import {
  DITTO_DOMAIN as ditto_domain,
  DITTO_USERNAME as ditto_username,
  DITTO_PASSWORD as ditto_password,
} from "./config";

const { Footer, Content } = Layout;
const { TabPane } = Tabs;

const PROJECT = process.env.REACT_APP_PROJECT;
const PROJECT_URL = process.env["REACT_APP_" + PROJECT + "_URL"];
const PROJECT_LOGO = "../" + PROJECT.toLowerCase() + "_logo.png";

const logger = winston_logger.child({ source: "App.js" });

const buildDittoClient = () =>
  DittoDomClient.newHttpClient()
    .withoutTls()
    .withDomain(ditto_domain)
    .withAuthProvider(
      DomHttpBasicAuth.newInstance(ditto_username, ditto_password)
    )
    .build();

const ditto_client = buildDittoClient();

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      devices: [],
      physical_devices: [],
      virtual_devices: [],
      trust_agents: [],
      deployments: [],
      activeTab: "1",
      handleTabChange: this.handleTabChange,
      ditto_client,
    };
    this.Tabs = React.createRef();
  }

  componentDidMount() {
    this.initDittoClient()
      .then((result) => this.setState({ ditto_client: result }))
      .catch((e) => logger.error("Failed to init Ditto client: " + e.message));
    this.getAllDevices()
      .then((result) => this.setState({ devices: result }))
      .catch((e) => logger.error("Failed to fetch devices: " + e.message));
    this.getAllPhysicalDevices()
      .then((result) => this.setState({ physical_devices: result }))
      .catch((e) =>
        logger.error("Failed to fetch physical devices: " + e.message)
      );
    this.getAllVirtualDevices()
      .then((result) => this.setState({ virtual_devices: result }))
      .catch((e) =>
        logger.error("Failed to fetch virtual devices: " + e.message)
      );
    this.getAllTrustAgents()
      .then((result) => this.setState({ trust_agents: result }))
      .catch((e) => logger.error("Failed to fetch trust agents: " + e.message));
    this.getAllDeployments()
      .then((result) => this.setState({ deployments: result }))
      .catch((e) => logger.error("Failed to fetch deployments: " + e.message));
  }

  handleTabChange = (tabNo) => {
    this.setState({ activeTab: tabNo });
  };

  render() {
    const { activeTab } = this.state;

    return (
      <GlobalContext.Provider value={this.state}>
        <div className="App">
          <Layout style={{ minHeight: "100vh" }}>
            <Content
              style={{ background: "#fff", padding: 0, textAlign: "left" }}
            >
              <Row>
                <Col span={12} offset={6}>
                  <Tabs
                    id="Tabs"
                    activeKey={activeTab}
                    ref={this.Tabs}
                    onTabClick={(tab) => this.handleTabChange(tab)}
                  >
                    <TabPane
                      disabled
                      key="project-logo"
                      tab={
                        <span>
                          <img
                            style={{ height: "40px" }}
                            src={PROJECT_LOGO}
                            alt="Project logo"
                          />
                        </span>
                      }
                    ></TabPane>
                    <TabPane
                      key="1"
                      tab={
                        <span>
                          <Icon type="bulb" />
                          Devices
                        </span>
                      }
                    >
                      <DeviceArea />
                    </TabPane>
                    <TabPane
                      key="2"
                      tab={
                        <span>
                          <Icon type="safety-certificate" />
                          Software/Firmware
                        </span>
                      }
                    >
                      <TrustAgentArea />
                    </TabPane>
                    <TabPane
                      key="3"
                      tab={
                        <span>
                          <Icon type="code-sandbox" />
                          Deployments
                        </span>
                      }
                    >
                      <DeploymentArea />
                    </TabPane>
                    <TabPane
                      key="4"
                      tab={
                        <span>
                          <Icon type="control" />
                          Create Deployment
                        </span>
                      }
                    >
                      <CreateDeploymentArea />
                    </TabPane>
                  </Tabs>
                </Col>
              </Row>
            </Content>

            <Footer>
              <p>
                This work is supported by <a href={PROJECT_URL}>ENTRUST</a>{" "}
                and powered by{" "}
                <a href="https://www.eclipse.org/ditto/">Eclipse Ditto</a>.
              </p>
              <p>The project has received funding from the European Union's Horizon 2020 research and innovation programme under grant agreement No 101020416.</p>
              <img src="h2020_logo.png" width="200" alt="H2020 logo" />
              <p>
                {" "}
                Please visit{" "}
                <a href="https://github.com/SINTEF-9012/ditto-fleet">
                  <Icon type="github" />
                </a>{" "}
                for further details.
              </p>
            </Footer>
          </Layout>
        </div>
      </GlobalContext.Provider>
    );
  }

  /**
   * Get all devices (any type) from Ditto
   */
  getAllDevices = async () => {
    const searchHandle = ditto_client.getSearchHandle();

    var options = DefaultSearchOptions.getInstance()
      .withFilter(
        'in(attributes/type,"device","physical_device","virtual_device")'
      )
      .withSort("+attributes/type")
      .withLimit(0, 200);
    var devices = (await searchHandle.search(options)).items;
    logger.debug(JSON.stringify(devices));
    return devices;
  };

  /**
   * Get all physical devices from Ditto
   */
  getAllPhysicalDevices = async () => {
    const searchHandle = ditto_client.getSearchHandle();

    var options = DefaultSearchOptions.getInstance()
      .withFilter('eq(attributes/type,"physical_device")')
      .withSort("+thingId")
      .withLimit(0, 200);
    var devices = (await searchHandle.search(options)).items;
    return devices;
  };

  /**
   * Get all virtual devices from Ditto
   */
  getAllVirtualDevices = async () => {
    const searchHandle = ditto_client.getSearchHandle();

    var options = DefaultSearchOptions.getInstance()
      .withFilter('eq(attributes/type,"virtual_device")')
      .withSort("+thingId")
      .withLimit(0, 200);
    var devices = (await searchHandle.search(options)).items;
    return devices;
  };

  /**
   * Get all trust agents from Ditto
   */
  getAllTrustAgents = async () => {
    const searchHandle = ditto_client.getSearchHandle();

    var options = DefaultSearchOptions.getInstance()
      .withFilter(
        'in(attributes/type,"agent","trust_agent","trust_agent_docker","trust_agent_ssh","trust_agent_axis")'
      )
      .withSort("+thingId")
      .withLimit(0, 200);
    var trust_agents = (await searchHandle.search(options)).items;
    logger.debug(JSON.stringify(trust_agents));
    return trust_agents;
  };

  /**
   * Get all deployments from Ditto
   */
  getAllDeployments = async () => {
    const searchHandle = ditto_client.getSearchHandle();

    var options = DefaultSearchOptions.getInstance()
      .withFilter('eq(attributes/type,"deployment")')
      .withSort("+thingId")
      .withLimit(0, 200);
    var deployments = (await searchHandle.search(options)).items;
    logger.debug(JSON.stringify(deployments));
    return deployments;
  };

  initDittoClient = async () => {
    return buildDittoClient();
  };
}

export default App;
