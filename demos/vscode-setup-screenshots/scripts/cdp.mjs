import { setTimeout as delay } from 'node:timers/promises';

export class VSCodeControl {
  constructor(port, expectedAppPath) {
    this.port = port;
    this.expectedAppPath = expectedAppPath;
    this.socket = null;
    this.nextId = 0;
    this.pending = new Map();
  }

  async connect() {
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
      throw new Error(`Invalid DevTools port: ${this.port}`);
    }
    const expectedUrlPrefix = `vscode-file://vscode-app${encodeURI(this.expectedAppPath)}/`;
    const deadline = Date.now() + 30_000;
    let target;
    while (Date.now() < deadline) {
      let pages;
      try {
        const response = await fetch(`http://127.0.0.1:${this.port}/json`);
        if (!response.ok) throw new Error(`Unexpected DevTools HTTP status ${response.status}`);
        pages = await response.json();
      } catch {
        await delay(250);
        continue;
      }
      const ownPages = pages.filter((page) => page.type === 'page'
        && page.title !== ''
        && page.url?.startsWith(expectedUrlPrefix));
      if (ownPages.length > 1) throw new Error(`Multiple VS Code targets matched the launched app copy on port ${this.port}`);
      if (ownPages.length === 1) {
        target = ownPages[0];
        break;
      }
      await delay(250);
    }
    if (!target) throw new Error(`No page for launched VS Code app ${this.expectedAppPath} on DevTools port ${this.port}`);

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
    const attachedUrl = await this.evaluate('location.href');
    if (!attachedUrl?.startsWith(expectedUrlPrefix)) {
      this.close();
      throw new Error(`Attached DevTools target changed identity: ${attachedUrl}`);
    }
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

  async waitForPaint() {
    const timestamp = await this.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))))');
    if (!Number.isFinite(timestamp)) throw new Error('The VS Code renderer did not produce two fresh animation frames.');
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
    const deadline = Date.now() + 10_000;
    let inputReady = false;
    while (Date.now() < deadline) {
      inputReady = await this.evaluate(`(() => {
        const widget = document.querySelector('.quick-input-widget');
        const input = widget?.querySelector('input, textarea');
        return !!widget?.getBoundingClientRect().height && input === document.activeElement;
      })()`);
      if (inputReady) break;
      await delay(100);
    }
    if (!inputReady) throw new Error(`Quick Open did not become ready before opening ${relativePath}.`);
    await this.type(relativePath);
    const enteredPath = await this.evaluate("document.querySelector('.quick-input-widget input, .quick-input-widget textarea')?.value");
    if (enteredPath !== relativePath) throw new Error(`Quick Open received ${JSON.stringify(enteredPath)} instead of ${relativePath}.`);
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

  async moveToSelector(selector) {
    const point = await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`Visible UI element not found: ${selector}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  }

  async clickNotificationAction(messagePart, actionLabel, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const clicked = await this.evaluate(`(() => {
        const messagePart = ${JSON.stringify(messagePart.toLowerCase())};
        const actionLabel = ${JSON.stringify(actionLabel)};
        const toast = [...document.querySelectorAll('.notifications-toasts .notification-toast')]
          .find((item) => item.innerText.toLowerCase().includes(messagePart));
        if (!toast) return false;
        const button = [...toast.querySelectorAll('button, [role="button"]')]
          .find((item) => item.textContent.trim() === actionLabel);
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (clicked) return true;
      await delay(250);
    }
    return false;
  }

  async clickExplorerFile(filename) {
    const point = await this.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.monaco-list-row')];
      const row = rows.find((element) => {
        const label = element.getAttribute('aria-label') || '';
        return label.includes(${JSON.stringify(filename)}) || element.textContent.includes(${JSON.stringify(filename)});
      });
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`Explorer file row not found: ${filename}`);
    await this.click(point.x, point.y);
  }

  async dragExplorerFileToFolder(filename, folderName) {
    const points = await this.evaluate(`(() => {
      const findRow = (name) => [...document.querySelectorAll('.explorer-folders-view .monaco-list-row')]
        .find((element) => element.getAttribute('aria-label') === name);
      const source = findRow(${JSON.stringify(filename)});
      const target = findRow(${JSON.stringify(folderName)});
      if (!source || !target) return null;
      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return {
        source: { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height / 2 },
        target: { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 }
      };
    })()`);
    if (!points) throw new Error(`Explorer drag rows not found: ${filename} -> ${folderName}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.source.x, y: points.source.y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: points.source.x, y: points.source.y, button: 'left', buttons: 1, clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.source.x + 6, y: points.source.y + 3, button: 'left', buttons: 1 });
    await delay(150);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.target.x, y: points.target.y, button: 'left', buttons: 1 });
    await delay(500);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: points.target.x, y: points.target.y, button: 'left', buttons: 0, clickCount: 1 });
  }

  async clearNotifications() {
    const count = await this.evaluate("document.querySelectorAll('.notifications-toasts .notification-toast').length");
    if (count > 0) await this.command('Notifications: Clear All Notifications');
    await this.key('Escape', 'Escape');
  }

  async assertNoModalOrToast() {
    const state = await this.notificationState();
    if (state.toasts.length || state.dialogs.length || state.restartPrompt) {
      throw new Error(`Unexpected toast or dialog in capture: ${JSON.stringify(state)}`);
    }
  }

  async assertExpectedOperationConfirmation() {
    const state = await this.notificationState();
    const text = state.dialogs.join('\n');
    if (!/move|drag/i.test(text) || state.toasts.length || state.restartPrompt) {
      throw new Error(`Expected an Explorer move confirmation dialog, found ${JSON.stringify(state)}`);
    }
  }

  async assertExpectedRecommendationToast() {
    const state = await this.notificationState();
    const text = state.toasts.join('\n');
    if (!/recommend/i.test(text) || state.dialogs.length || state.restartPrompt) {
      throw new Error(`Expected an extension recommendation toast, found ${JSON.stringify(state)}`);
    }
  }

  async notificationState() {
    return this.evaluate(`({
      toasts: [...document.querySelectorAll('.notifications-toasts .notification-toast')].map((element) => element.innerText),
      dialogs: [...document.querySelectorAll('.monaco-dialog-box, .monaco-dialog-modal-block, [aria-modal="true"]')].map((element) => element.innerText),
      restartPrompt: document.body.innerText.includes('requires a restart to take effect')
    })`);
  }

  close() {
    this.socket?.close();
  }
}

function keyCode(key) {
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return ({ Enter: 13, Escape: 27, Backspace: 8, Tab: 9, Space: 32, End: 35, ArrowDown: 40, ArrowUp: 38 })[key] ?? 0;
}
