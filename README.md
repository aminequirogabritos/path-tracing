After downloading the project, run the following commands:

npm install
npm run dev

--------------------------------------------------------------
To log and save GPU usage (nvidia card)

nvidia-smi --query-gpu=timestamp, utilization.gpu, temperature.gpu, memory.used, memory.total --format=csv -l [period in seconds] > [filename].csv

^^^ PROBLEM: only registers 1 second

--------------------------------------------------------------
To log with less than 1 sample per second

python3 -m venv venv (first time)
source venv/bin/activate
python profiler.py
deactivate
