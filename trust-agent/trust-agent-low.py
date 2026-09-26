import time
# using datetime module
import datetime
import platform    # For getting the operating system name
import subprocess  # For executing a shell command
import argparse

# Instantiate the parser
parser = argparse.ArgumentParser(description='Trust agent for low-end devices')
# Required positional argument
parser.add_argument('host', type=str,
                    help='A required host URL')
args = parser.parse_args()
print(args.host)

def ping(host):
    """
    Returns True if host (str) responds to a ping request.
    Remember that a host may not respond to a ping (ICMP) request even if the host name is valid.
    """

    # Option for the number of packets as a function of
    param = '-n' if platform.system().lower()=='windows' else '-c'

    # Building the command. Ex: "ping -c 1 google.com"
    command = ['ping', param, '1', host]

    return subprocess.call(command) == 0

while (True):
    # ct stores current time
    ct = datetime.datetime.now()
    print("Trust agent is running... ", ct, ct.timestamp()) 
    ping(args.host)   
    time.sleep(10)

