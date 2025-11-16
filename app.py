import os
import json
import gspread
import openai
from flask import Flask, request, jsonify, render_template, Response
from openai import OpenAI
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='.')
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["60 per hour", "2 per second"],
    storage_uri="memory://", # Use memory for simplicity, consider Redis for production
)

# --- CONFIGURATION ---
# 1. OpenAI API Key
# Ensure you have an OPENAI_API_KEY in your .env file
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a helpful research assistant. You are based on OpenAI's GPT-4.1 model.")
GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "LLM_Interactions")
HISTORY_MAX_TOKENS = int(os.getenv("HISTORY_MAX_TOKENS", 2048))

# 2. Google Sheets API Credentials
# - Enable the Google Sheets API and Google Drive API in your Google Cloud project.
# - Create a service account and download its JSON key file.
# - Place the key file in the same directory and name it 'service_account.json'.
# - Share your Google Sheet with the service account's email address.
try:
    gc = gspread.service_account(filename='service_account.json')
    # 3. Google Sheet Name
    # Replace 'LLM_Interactions' with the actual name of your Google Sheet
    spreadsheet = gc.open(GOOGLE_SHEET_NAME)
    worksheet = spreadsheet.sheet1
    # Set header row if the sheet is empty or doesn't match
    header = ["Timestamp", "Interaction ID", "User Message", "LLM Response", "Feedback Options", "Comment"]
    if not worksheet.get_all_values() or worksheet.row_values(1) != header:
        worksheet.clear()
        worksheet.append_row(header)
        
except FileNotFoundError:
    print("\n!!! WARNING: 'service_account.json' not found. Google Sheets logging will fail. !!!")
    print("Please follow the setup instructions in the README to enable data logging.\n")
    worksheet = None
except gspread.exceptions.SpreadsheetNotFound:
    print(f"\n!!! WARNING: Google Sheet '{GOOGLE_SHEET_NAME}' not found. Logging will fail. !!!")
    print("Please create a sheet with that name and share it with your service account.\n")
    worksheet = None


@app.route('/')
def index():
    """Render the main chat interface."""
    return render_template('index.html')

def truncate_history(history):
    """Truncates the history to be within the token limit."""
    # A simple approximation: 1 token ~= 4 characters
    # This is a very rough estimate, but it's better than nothing.
    # For a more accurate approach, a proper tokenizer library would be needed.
    current_tokens = sum(len(m['content']) for m in history) / 4
    if current_tokens > HISTORY_MAX_TOKENS:
        # Remove oldest messages until the token count is within the limit
        while current_tokens > HISTORY_MAX_TOKENS:
            removed_message = history.pop(0)
            current_tokens -= len(removed_message['content']) / 4
    return history

@app.route('/chat', methods=['POST'])
@limiter.limit("60 per hour")
def chat():
    """Endpoint to handle chat interaction with the LLM."""
    user_message = request.json.get("message")
    history = request.json.get("history", [])
    interaction_id = request.json.get("interaction_id")

    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    try:
        # --- LLM INTERACTION (Streaming) ---
        history = truncate_history(history)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ] + history + [
            {"role": "user", "content": user_message}
        ]

        def generate():
            full_response = ""
            try:
                stream = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=messages,
                    stream=True,
                )
                for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        full_response += content
                        yield content
                
                # Log the full interaction after the stream is complete
                if worksheet:
                    try:
                        log_to_sheet(interaction_id, user_message, full_response)
                    except Exception as e:
                        print(f"Error logging to Google Sheet: {e}")
                        pass
            except openai.APIStatusError as e:
                print(f"OpenAI API Status Error: {e}")
                yield "Error: Could not connect to the AI service."
            except openai.APIError as e:
                print(f"OpenAI API Error: {e}")
                yield "Error: An unexpected error occurred with the AI service."

        return Response(generate(), mimetype='text/plain')

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An unexpected error occurred. Please check the server logs."}), 500

@app.route('/survey', methods=['POST'])
def survey():
    """Endpoint to handle survey submission."""
    data = request.get_json()
    interaction_id = data.get('interaction_id')
    feedback_options = data.get('feedback_options', [])
    comment = data.get('comment', '') # Default to empty string

    if not interaction_id or not feedback_options:
        return jsonify({"error": "Missing interaction ID or feedback options"}), 400
        
    if worksheet:
        try:
            # Find the row with the matching interaction ID and update it
            cell = worksheet.find(interaction_id)
            if cell:
                # Join feedback options into a comma-separated string
                feedback_str = ", ".join(feedback_options)
                worksheet.update_cell(cell.row, 5, feedback_str) # Column 5 is "Feedback Options"
                worksheet.update_cell(cell.row, 6, comment)     # Column 6 is "Comment"
            else:
                # This should not happen if the chat is logged correctly
                print(f"Could not find interaction ID {interaction_id} to update survey data.")

        except Exception as e:
            print(f"Could not write survey data to Google Sheet. Error: {e}")
            return jsonify({"error": "Could not save survey data."}), 500

    return jsonify({"status": "success"}), 200


def log_to_sheet(interaction_id, user_msg, llm_response):
    """Appends a new row to the configured Google Sheet."""
    import datetime
    timestamp = datetime.datetime.now().isoformat()
    try:
        worksheet.append_row([timestamp, interaction_id, user_msg, llm_response, "N/A", ""])
    except Exception as e:
        print(f"Could not write to Google Sheet. Error: {e}")
        raise
