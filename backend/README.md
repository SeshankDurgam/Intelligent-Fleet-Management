This project is a Digital Twin platform for software management on a fleet of devices within the IoT-Edge-Cloud continuum. The backbone of the platform is [https://www.eclipse.org/ditto/](Eclipse Ditto). The platform also comes with a back-end, which listens for changes in the managed digital twins.

## Docker

`docker image build --tag rdautov/ditto-fleet-backend:0.1 --platform linux/amd64 .`

### Stand-alone Docker container

To run the GUI please pull the latest version of the `dautov:ditto-fleet-backend` image and run the following command:

`docker run --network="host" -it rdautov:ditto-fleet-backend`

This will run the `npm start` script and launch the NodeJS application.

### Together with Eclipse Ditto and GUI via Docker-Compose (recommended)

TODO
