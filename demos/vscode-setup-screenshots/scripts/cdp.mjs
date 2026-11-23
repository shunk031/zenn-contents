import { setTimeout as delay } from 'node:timers/promises';

export class VSCodeControl {
  constructor(port) {
    this.port = port;
    this.socket = null;
    this.nextId = 0;
    this.pending = new Map();
  }

  async connect() {
    const deadline = Date.now() + 30_000;
    let target;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.port}/json`);
        const pages = await response.json();
        target = pages.find((page) => page.type === 'page' && page.title !== '');
        if (target) break;
      } catch {}
      await delay(250);
    }
    if (!target) throw new Error(`No VS Code page on DevTools port ${this.port}`);

    this.socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DevTools connection timed out')), 10_000);
      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('DevTools connection failed'));
      }, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    const rejectPending = () => {
      for (const pending of this.pending.values()) pending.reject(new Error('DevTools connection closed'));
      this.pending.clear();
    };
    this.socket.addEventListener('close', rejectPending, { once: true });
    this.socket.addEventListener('error', rejectPending, { once: true });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        this.pending.delete(id);
        reject(error);
        return;
      }
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`DevTools request timed out: ${method}`));
      }, 10_000).unref?.();
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }

  async key(key, code, modifiers = 0) {
    const params = { key, code, modifiers, windowsVirtualKeyCode: keyCode(key) };
    await this.send('Input.dispatchKeyEvent', { ...params, type: 'keyDown' });
    await this.send('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
  }

  async type(text) {
    await this.send('Input.insertText', { text });
  }

  async command(label) {
    await this.key('Escape', 'Escape');
    await this.key('P', 'KeyP', 12);
    await delay(250);
    await this.type(label);
    await delay(250);
    await this.key('Enter', 'Enter');
    await delay(700);
  }

  async openFile(relativePath) {
    await this.key('Escape', 'Escape');
    await this.key('P', 'KeyP', 4);
    await delay(200);
    await this.type(relativePath);
    await delay(350);
    await this.key('Enter', 'Enter');
    await delay(450);
  }

  async gotoLine(line, column = 1) {
    await this.key('Escape', 'Escape');
    await this.key('G', 'KeyG', 2);
    await delay(200);
    await this.type(`${line}:${column}`);
    await this.key('Enter', 'Enter');
    await delay(250);
  }

  async click(x, y, modifiers = 0) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers });
  }

  async moveToText(text) {
    const points = await this.evaluate(`(() => {
      const query = ${JSON.stringify(text)};
      const found = [];
      for (const line of document.querySelectorAll('.monaco-editor .view-line')) {
        const nodes = [];
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const flat = nodes.map(node => node.textContent || '').join('');
        let offset = 0;
        while ((offset = flat.indexOf(query, offset)) >= 0) {
          let remainingStart = offset;
          let remainingEnd = offset + query.length;
          let startNode, endNode, startOffset, endOffset;
          let consumed = 0;
          for (const node of nodes) {
            const length = (node.textContent || '').length;
            if (!startNode && remainingStart < consumed + length) {
              startNode = node;
              startOffset = remainingStart - consumed;
            }
            if (remainingEnd <= consumed + length) {
              endNode = node;
              endOffset = remainingEnd - consumed;
              break;
            }
            consumed += length;
          }
          if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) found.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
          }
          offset += query.length;
        }
      }
      return found;
    })()`);
    if (!points?.length) throw new Error(`Visible editor text not found: ${text}`);
    return points;
  }

  async clearNotifications() {
    const count = await this.evaluate("document.querySelectorAll('.notifications-toasts .notification-toast').length");
    if (count > 0) await this.command('Notifications: Clear All Notifications');
    await this.key('Escape', 'Escape');
  }

  async assertNoModalOrToast() {
    const counts = await this.evaluate(`({
      toasts: document.querySelectorAll('.notifications-toasts .notification-toast').length,
      dialogs: document.querySelectorAll('.monaco-dialog-box, .monaco-dialog-modal-block, [aria-modal="true"]').length,
      restartPrompt: document.body.innerText.includes('requires a restart to take effect')
    })`);
    if (counts.toasts || counts.dialogs || counts.restartPrompt) {
      throw new Error(`Unexpected toast or dialog in capture: ${JSON.stringify(counts)}`);
    }
  }

  close() {
    this.socket?.close();
  }
}

function keyCode(key) {
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return ({ Enter: 13, Escape: 27, Backspace: 8, Tab: 9, Space: 32, End: 35, ArrowDown: 40, ArrowUp: 38 })[key] ?? 0;
}
