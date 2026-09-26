import time
# using datetime module
import datetime;

while (True):
    # ct stores current time
    ct = datetime.datetime.now()
    print("Trust agent is running... ", ct, ct.timestamp())    
    time.sleep(10)