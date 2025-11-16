document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const surveyContainer = document.getElementById('survey-container');
    const surveyOptions = document.querySelectorAll('.survey-option');
    const surveyComment = document.getElementById('survey-comment');
    const surveySubmitBtn = document.getElementById('survey-submit-btn');
    const errorMessageDiv = document.getElementById('error-message'); // New
    const loadingIndicatorDiv = document.getElementById('loading-indicator'); // New

    let history = []; // Array to store conversation history
    let currentInteractionId = null;
    let selectedSurveyOption = null;

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const addMessage = (message, sender, type = 'text') => {
        const messageElement = document.createElement('div');
        const messageClass = sender === 'user' ? 'user-message' : (type === 'error' ? 'error-message' : 'llm-message');
        messageElement.classList.add('message', messageClass);

        const p = document.createElement('p');
        if (sender === 'user') {
            p.textContent = message;
        } else {
            p.innerHTML = marked.parse(message);
        }
        messageElement.appendChild(p);

        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        return messageElement;
    };

    // New helper functions for error and loading
    const showError = (message) => {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
    };

    const clearError = () => {
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.display = 'none';
    };

    const showLoading = () => {
        loadingIndicatorDiv.style.display = 'block';
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to show indicator
    };

    const hideLoading = () => {
        loadingIndicatorDiv.style.display = 'none';
    };

    const handleSend = async () => {
        const message = userInput.value.trim();
        if (!message) return;

        clearError(); // Clear previous errors
        currentInteractionId = generateUUID();
        addMessage(message, 'user');
        history.push({ role: 'user', content: message });

        userInput.value = '';
        userInput.style.height = 'auto';
        setLoadingState(true); // This will now show the new loading indicator
        hideSurvey();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message, history: history.slice(0, -1), interaction_id: currentInteractionId }),
            });

            setLoadingState(false); // Hide loading indicator

            if (!response.ok) {
                const errorData = await response.json();
                showError(errorData.error || 'An unknown error occurred.'); // Display user-friendly error
                history.pop();
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let llmResponse = '';
            
            const llmMessageElement = addMessage('', 'llm');
            const llmParagraph = llmMessageElement.querySelector('p');

            reader.read().then(function processText({ done, value }) {
                if (done) {
                    history.push({ role: 'assistant', content: llmResponse });
                    updateCodeBlocks(llmMessageElement);
                    showSurvey();
                    return;
                }

                const chunk = decoder.decode(value, { stream: true });
                llmResponse += chunk;
                llmParagraph.innerHTML = marked.parse(llmResponse);
                chatBox.scrollTop = chatBox.scrollHeight;

                reader.read().then(processText);
            });

        } catch (error) {
            setLoadingState(false); // Hide loading indicator
            console.error('Error:', error);
            showError('Failed to connect to the server. Please try again later.'); // Display generic error
            history.pop();
        }
    };

    const setLoadingState = (isLoading) => {
        if (isLoading) {
            userInput.disabled = true;
            sendBtn.disabled = true;
            showLoading(); // Use new showLoading
        } else {
            userInput.disabled = false;
            sendBtn.disabled = false;
            hideLoading(); // Use new hideLoading
            userInput.focus();
        }
    };

    // Remove showTypingIndicator and removeTypingIndicator functions
    // as they are replaced by the new loading indicator logic.

    const updateCodeBlocks = (messageElement) => {
        const codeBlocks = messageElement.querySelectorAll('pre');
        codeBlocks.forEach(pre => {
            const code = pre.querySelector('code');
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy';
            copyBtn.classList.add('copy-code-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(code.textContent);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            });
            pre.appendChild(copyBtn);
        });
    };

    const handleClearChat = () => {
        chatBox.innerHTML = '';
        history = [];
        hideSurvey();
        clearError(); // Clear errors on chat clear
        addMessage('Hello! How can I assist you with your research today?', 'llm');
    };

    const showSurvey = () => {
        surveyContainer.style.display = 'flex';
    };

    const hideSurvey = () => {
        surveyContainer.style.display = 'none';
        surveyComment.value = '';
        surveyOptions.forEach(opt => opt.classList.remove('selected'));
        selectedSurveyOption = null;
    };

    const handleSurveySubmit = async () => {
        if (!selectedSurveyOption) {
            alert('Please select an option.');
            return;
        }

        const comment = surveyComment.value.trim();
        
        try {
            await fetch('/survey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    interaction_id: currentInteractionId,
                    rating: selectedSurveyOption,
                    comment: comment,
                }),
            });
            hideSurvey();
        } catch (error) {
            console.error('Error submitting survey:', error);
            alert('Failed to submit feedback. Please try again later.');
        }
    };

    sendBtn.addEventListener('click', handleSend);
    clearBtn.addEventListener('click', handleClearChat);
    surveySubmitBtn.addEventListener('click', handleSurveySubmit);

    surveyOptions.forEach(option => {
        option.addEventListener('click', () => {
            surveyOptions.forEach(opt => opt.classList.remove('selected'));

            option.classList.add('selected');
            selectedSurveyOption = option.dataset.value;
        });
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // Initial message
    if (history.length === 0) {
        addMessage('Hello! How can I assist you with your research today?', 'llm');
    }
});