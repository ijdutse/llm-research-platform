# LLM Research Chat Interface

This project is a web-based chat interface that connects to an LLM (like OpenAI's GPT) and logs all interactions to a Google Sheet for research purposes.

## File Structure

```
.
├── .env                  # Environment variables (API keys, config)
├── app.py                # The Python Flask backend server
├── index.html            # The main HTML file for the chat interface
├── requirements.txt      # Python dependencies
├── static/
│   ├── script.js         # Frontend JavaScript for chat logic
│   └── style.css         # CSS for styling the interface
└── service_account.json  # IMPORTANT: Your Google Service Account key (you must provide this)
```

## Setup and Running the Application

Follow these steps carefully to get the application running.

### Step 1: Google Cloud & Sheets Setup

1.  **Create a Google Sheet:**
    *   Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
    *   You can name it anything you like. You will specify the name in the `.env` file later.

2.  **Set up a Google Cloud Project:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project (or use an existing one).
    *   In the project dashboard, search for and **enable the "Google Drive API" and "Google Sheets API"**.

3.  **Create a Service Account:**
    *   In the Google Cloud Console, navigate to "IAM & Admin" > "Service Accounts".
    *   Click "+ CREATE SERVICE ACCOUNT".
    *   Give it a name (e.g., "sheets-logger") and a description. Click "CREATE AND CONTINUE".
    *   For permissions, grant the "Editor" role to this service account so it can edit your sheets. Click "CONTINUE".
    *   Skip the "Grant users access to this service account" step and click "DONE".

4.  **Generate a JSON Key:**
    *   Find the service account you just created in the list.
    *   Click the three-dot menu under "Actions" and select "Manage keys".
    *   Click "ADD KEY" > "Create new key".
    *   Choose **JSON** as the key type and click "CREATE". A JSON file will be downloaded to your computer.

5.  **Configure Access:**
    *   Rename the downloaded JSON file to **`service_account.json`** and place it in the root directory of this project.
    *   Open the `service_account.json` file and find the `client_email` address (it looks like `...gserviceaccount.com`).
    *   Open your Google Sheet, click the "Share" button in the top right, and paste the `client_email` address. Give it "Editor" permissions.

### Step 2: Configuration

1.  **Create a `.env` file:**
    *   In the root of the project directory, create a new file named `.env`.
    *   Add the following configuration variables to this file:

        ```
        OPENAI_API_KEY="your-sk-xxxxxxxxxxxxxxxxxxxxxx"
        GOOGLE_SHEET_NAME="Your Google Sheet Name"
        OPENAI_MODEL="gpt-3.5-turbo"
        SYSTEM_PROMPT="You are a helpful research assistant."
        HISTORY_MAX_TOKENS=2048
        ```

    *   **`OPENAI_API_KEY`**: Your secret API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
    *   **`GOOGLE_SHEET_NAME`**: The name of the Google Sheet you created in Step 1.
    *   **`OPENAI_MODEL`**: The model you want to use (e.g., `gpt-4`, `gpt-3.5-turbo`).
    *   **`SYSTEM_PROMPT`**: The system prompt for the LLM.
    *   **`HISTORY_MAX_TOKENS`**: The maximum number of tokens to keep in the conversation history.

### Step 3: Install Dependencies and Run the Server

1.  **Open your terminal** in the project directory.

2.  **Create a virtual environment (highly recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
    *Using a virtual environment prevents conflicts with other Python projects on your system.*

3.  **Install the required Python packages:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the Flask application:**
    ```bash
    python app.py
    ```

### Step 4: Access the Chat Interface

1.  Once the server is running, it will print a message like:
    `* Running on http://127.0.0.1:5001`

2.  Open your web browser and navigate to **http://127.0.0.1:5001**.

### How to Use the Interface

*   Type your message in the input box at the bottom and press Enter or click the "Send" button.
*   The conversation will be displayed in the chat box.
*   You can copy code blocks by clicking the "Copy" button that appears in the top-right corner of the code block.
*   To clear the chat history, click the "Clear Chat" button in the header.

### Troubleshooting

*   **`gspread.exceptions.SpreadsheetNotFound`**: This error means the Google Sheet with the name you specified in `GOOGLE_SHEET_NAME` was not found. Make sure the name is correct and that you have shared the sheet with your service account's email address.
*   **`FileNotFoundError: [Errno 2] No such file or directory: 'service_account.json'`**: This error means the `service_account.json` file is missing. Make sure you have downloaded the key file, renamed it to `service_account.json`, and placed it in the root directory of the project.
*   **`openai.AuthenticationError`**: This error means your OpenAI API key is invalid. Make sure you have set the `OPENAI_API_KEY` correctly in your `.env` file.
