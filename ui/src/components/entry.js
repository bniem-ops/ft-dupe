import { html } from 'htm/preact';
import { useRef, useState } from 'preact/hooks';

const CODE_LENGTH = 4;
const NAME_STORAGE_KEY = 'flockName';

// One screen for every way into a game: claim a name, then either host
// (creates a lobby with default settings you edit live once you're in it),
// join a code (no separate screen — the 4 boxes accept a paste of the
// whole code and auto-advance), or skip straight to a solo game.
export function Entry({ onHost, onJoin, onSolo, error }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) ?? '');
  const [code, setCode] = useState(['', '', '', '']);
  const boxRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const trimmedName = name.trim();
  const fullCode = code.join('');

  function saveName() {
    if (trimmedName) localStorage.setItem(NAME_STORAGE_KEY, trimmedName);
  }

  function setChar(i, char) {
    setCode((cur) => {
      const next = [...cur];
      next[i] = char;
      return next;
    });
  }

  function handleBoxInput(i, e) {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length > 1) {
      // A paste landed in one box — spread it across this box and the rest.
      const chars = raw.slice(0, CODE_LENGTH - i).split('');
      setCode((cur) => {
        const next = [...cur];
        chars.forEach((c, offset) => {
          next[i + offset] = c;
        });
        return next;
      });
      const lastIndex = Math.min(i + chars.length, CODE_LENGTH - 1);
      boxRefs[lastIndex].current?.focus();
      return;
    }
    setChar(i, raw);
    if (raw && i < CODE_LENGTH - 1) boxRefs[i + 1].current?.focus();
  }

  function handleBoxKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      boxRefs[i - 1].current?.focus();
    }
  }

  function handleHost(e) {
    e.preventDefault();
    if (!trimmedName) return;
    saveName();
    onHost(trimmedName);
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!trimmedName || fullCode.length !== CODE_LENGTH) return;
    saveName();
    onJoin(trimmedName, fullCode);
  }

  function handleSolo(e) {
    e.preventDefault();
    if (!trimmedName) return;
    saveName();
    onSolo(trimmedName);
  }

  return html`
    <div class="entry-screen">
      <div class="entry-backdrop"></div>
      <div class="entry-scrim"></div>
      <div class="entry-card">
        <div class="entry-title">
          <div class="entry-wordmark">FLOCK TOGETHER</div>
          <div class="entry-tagline">Survive the season. Keep the flock fed.</div>
        </div>

        ${error && html`<div class="error-banner">${error}</div>`}

        <div class="field entry-name-field">
          <label>YOUR NAME</label>
          <input
            type="text"
            value=${name}
            onInput=${(e) => setName(e.target.value)}
            onBlur=${saveName}
            placeholder="Enter your name"
            maxlength="20"
          />
        </div>

        <div class="entry-actions">
          <button type="button" class="entry-host-btn" disabled=${!trimmedName} onClick=${handleHost}>
            HOST A FLOCK
          </button>
          <div class="entry-host-hint">Opens a lobby — you pick the settings while others arrive.</div>

          <div class="entry-divider"><span>OR JOIN ONE</span></div>

          <div class="entry-join-row">
            <div class="entry-code-boxes">
              ${code.map(
                (char, i) => html`<input
                  key=${i}
                  ref=${boxRefs[i]}
                  type="text"
                  class="entry-code-box"
                  maxlength=${CODE_LENGTH}
                  value=${char}
                  onInput=${(e) => handleBoxInput(i, e)}
                  onKeyDown=${(e) => handleBoxKeyDown(i, e)}
                />`,
              )}
            </div>
            <button
              type="button"
              class="entry-join-btn"
              disabled=${!trimmedName || fullCode.length !== CODE_LENGTH}
              onClick=${handleJoin}
            >
              JOIN
            </button>
          </div>
        </div>

        <div class="entry-solo">
          Playing alone?
          <a href="#" onClick=${handleSolo}>Start a solo roost →</a>
        </div>
      </div>
    </div>
  `;
}
