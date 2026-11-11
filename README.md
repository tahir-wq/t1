# Tahir Iqbal — Portfolio

A personal portfolio website for Tahir Iqbal, a web developer and Computer Science student at the University of Central Punjab.

## Run locally

1. Open this folder in VS Code.
2. In the terminal, run:

   ```powershell
   npm install
   npm start
   ```

3. Open http://localhost:3000.

You can also press **F5** in VS Code to start the site and open it in your browser.

## Portfolio content

The portfolio uses the supplied portrait at `public/tahir-iqbal.jpg` and personal details provided for Tahir: Computer Science studies at the University of Central Punjab, Pakistan, and current learning in HTML, CSS, and JavaScript. The Services section lists the services Tahir provided. The Swift Cart and AutoCoverX project descriptions are also based on details he provided. Their SVG previews are clearly labeled illustrations, not screenshots or photos of the actual projects.

To update the content, edit `public/index.html`; visual styles are in `public/styles.css`, and navigation/scroll effects are in `public/app.js`. Replace `public/tahir-iqbal.jpg` to use a different portrait.

The **Let’s talk** links take visitors to the contact section. **Help** opens
the AI chat drawer.

## Run the AI help chat locally

The assistant in `ai/` uses Ollama on the same computer. Install Ollama, then
in a second PowerShell terminal run:

```powershell
cd ai
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
ollama pull qwen2.5:1.5b
$env:ASSISTANT_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
python assistant_server.py
```

Keep that terminal open while using the portfolio, which runs separately with
`npm start` at http://localhost:3000. The assistant API listens on
http://127.0.0.1:8788. AI chat works only while Ollama and the assistant
server are running; a public deployment needs the AI API hosted over HTTPS.
Each browser session has its own conversation history. The model stays loaded
for 10 minutes after a reply so follow-up questions avoid a cold model startup.
The first answer after starting Ollama can still take longer while the model
loads. In the chat box, press **Enter** to send and **Shift+Enter** for a new
line.

The contact link opens an email to `alitahirwassi786@gmail.com`. LinkedIn: [Tahir Iqbal](https://www.linkedin.com/in/tahir-iqbal-240045322/).
