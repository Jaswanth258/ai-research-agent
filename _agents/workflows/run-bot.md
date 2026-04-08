---
description: how to run the Agentic Research Bot
---

This project uses a local virtual environment (`venv`) to manage its dependencies. Follow these steps to run the bot on Windows.

## Activation and Execution

1. Open a PowerShell terminal in the project root.
2. Activate the virtual environment:
```powershell
.\venv\Scripts\activate
```
3. Run the application:
```powershell
python main.py
```
After running, you will be prompted to choose:
- **Mode 1**: Traditional CLI Mode
- **Mode 2**: Modern Web UI Mode

## Troubleshooting

- **ModuleNotFoundError**: Ensure you are using the activated environment. If the error persists, reinstall dependencies:
  ```powershell
  pip install -r requirements.txt
  ```
- **Hugging Face Model Download**: If you have issues downloading the `sentence-transformers` model, ensure you have an active internet connection. The bot will automatically attempt to download the model on the first run.

// turbo
## Quick Start Command
To run the bot in one go (with default activation):
```powershell
.\venv\Scripts\python.exe main.py
```
