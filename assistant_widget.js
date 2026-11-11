(function (global) {
  "use strict";

  const DEFAULT_API_URL = "http://127.0.0.1:8788";

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  class TradebrainAssistant {
    constructor(target, options) {
      this.container = typeof target === "string" ? document.querySelector(target) : target;
      if (!this.container) {
        throw new Error("Assistant container was not found.");
      }

      const settings = options || {};
      this.apiUrl = (settings.apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
      this.conversationId = this.getConversationId();
      this.container.replaceChildren();
      this.container.classList.add("tb-assistant");
      this.build();
      this.loadHistory();
    }

    getConversationId() {
      const key = "tradebrainAssistantConversationId";
      let conversationId = sessionStorage.getItem(key);
      if (!conversationId) {
        conversationId = crypto.randomUUID();
        sessionStorage.setItem(key, conversationId);
      }
      return conversationId;
    }

    build() {
      const header = makeElement("div", "tb-assistant__header");
      header.append(
        makeElement("h2", "tb-assistant__title", "AI Assistant"),
        makeElement("p", "tb-assistant__subtitle", "Ask a question to get started.")
      );

      this.language = document.createElement("select");
      this.language.className = "tb-assistant__language";
      this.language.setAttribute("aria-label", "Response language");
      [
        ["Auto Detect", "Auto Detect"],
        ["English", "English"],
        ["Urdu", "Urdu"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        this.language.appendChild(option);
      });

      this.messages = makeElement("div", "tb-assistant__messages");
      this.messages.setAttribute("role", "log");
      this.messages.setAttribute("aria-live", "polite");

      this.status = makeElement("p", "tb-assistant__status");
      this.status.setAttribute("role", "status");

      this.form = document.createElement("form");
      this.form.className = "tb-assistant__form";
      this.input = document.createElement("textarea");
      this.input.className = "tb-assistant__input";
      this.input.placeholder = "Type your question…";
      this.input.maxLength = 4000;
      this.input.rows = 2;
      this.input.setAttribute("aria-label", "Your message");
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          this.form.requestSubmit();
        }
      });
      this.sendButton = makeElement("button", "tb-assistant__send", "Send");
      this.sendButton.type = "submit";
      this.form.append(this.input, this.sendButton);
      this.form.addEventListener("submit", (event) => this.send(event));

      const controls = makeElement("div", "tb-assistant__controls");
      controls.append(makeElement("label", "", "Response language"), this.language);
      this.container.append(header, controls, this.messages, this.status, this.form);
      this.addMessage("assistant", "Hello! What would you like help with?");
    }

    addMessage(role, content) {
      const message = makeElement("div", `tb-assistant__message tb-assistant__message--${role}`);
      message.textContent = content;
      this.messages.appendChild(message);
      this.messages.scrollTop = this.messages.scrollHeight;
    }

    async request(path, options) {
      const response = await fetch(`${this.apiUrl}${path}`, options);
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Assistant server returned HTTP ${response.status}.`);
      }
      if (!response.ok) {
        throw new Error(data.error || `Assistant request failed (HTTP ${response.status}).`);
      }
      return data;
    }

    async loadHistory() {
      try {
        const data = await this.request(`/api/chat/history?conversation_id=${encodeURIComponent(this.conversationId)}`);
        if (data.messages.length) {
          this.messages.replaceChildren();
          data.messages.forEach((message) => this.addMessage(message.role, message.content));
        }
      } catch (error) {
        this.status.textContent = error.message;
      }
    }

    async send(event) {
      event.preventDefault();
      const message = this.input.value.trim();
      if (!message || this.sendButton.disabled) return;

      this.input.value = "";
      this.addMessage("user", message);
      this.sendButton.disabled = true;
      this.status.textContent = "Thinking…";

      try {
        const data = await this.request("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            language: this.language.value,
            conversation_id: this.conversationId,
          }),
        });
        this.addMessage("assistant", data.answer);
        this.status.textContent = "";
      } catch (error) {
        this.status.textContent = error.message;
      } finally {
        this.sendButton.disabled = false;
        this.input.focus();
      }
    }
  }

  global.TradebrainAssistant = TradebrainAssistant;
})(window);
