import sys
import os

# Force UTF-8 output so emoji in LLM log messages don't crash on Windows charmap terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Put root directory in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.agents.single_agent.agent import SingleAgent
from backend.agents.multi_agent.agent import MultiAgent

def run_cli_agent(agent_class, topic, agent_name):
    print(f"\n=== Running {agent_name} ===\n")
    agent = agent_class()
    report, metrics, steps = agent.run(topic)
    print("\n--- FINAL REPORT ---\n")
    print(report)
    print("\n--- METRICS ---")
    for k, v in metrics.items():
        print(f"{k}: {v}")
    print("\n--- STEP LOG ---")
    for s in steps:
        print(f"[STEP] {s}")
    return report, metrics, steps

def run_cli():
    print("\n=== Agentic Research Bot (CLI Mode) ===\n")
    print("1. Single-Agent Mode")
    print("2. Multi-Agent Mode")
    print("3. Comparison Mode (Run Both)")
    agent_choice = input("Select research architecture (1/2/3): ").strip()
    topic = input("Enter research topic: ")
    
    if agent_choice == "1":
        run_cli_agent(SingleAgent, topic, "Single-Agent System")
    elif agent_choice == "2":
        run_cli_agent(MultiAgent, topic, "Multi-Agent System")
    elif agent_choice == "3":
        print("\n>>> STARTING COMPARISON RUN <<<\n")
        run_cli_agent(SingleAgent, topic, "Single-Agent System")
        print("\n" + "="*50 + "\n")
        run_cli_agent(MultiAgent, topic, "Multi-Agent System")
    else:
        print("Invalid choice.")

def run_web():
    print("\n=== Agentic Research Bot (Web UI Mode) ===\n")
    print("Starting FastAPI server at http://127.0.0.1:8000")
    print("Press Ctrl+C to stop the server.")
    import uvicorn
    from backend.server import app
    uvicorn.run(app, host="127.0.0.1", port=8000)

def main():
    if "--web" in sys.argv:
        run_web()
        return

    print("\n=== Agentic Research Bot Launcher ===")
    print("1. Run in Traditional CLI Mode")
    print("2. Run in Modern Web UI Mode")
    choice = input("\nSelect mode (1/2): ").strip()
    if choice == "2":
        run_web()
    else:
        run_cli()

if __name__ == "__main__":
    main()
