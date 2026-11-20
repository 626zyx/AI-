/* A UI-only three-way prompt. Closing it always keeps the current page. */
import * as UI from './ui.js';

export function promptUnsavedChanges() {
  const previousFocus = document.activeElement;
  return new Promise(resolve => {
    UI.modal('保存任务配置？', '<p>任务配置有未保存的修改。可以保存为草稿后离开，或继续编辑。</p>',
      '<button type="button" class="btn" data-unsaved-choice="stay">继续编辑</button>'
      + '<button type="button" class="btn" data-unsaved-choice="discard">不保存离开</button>'
      + '<button type="button" class="btn primary" data-unsaved-choice="save">保存草稿并离开</button>');
    const overlay = document.getElementById('modal');
    const dialog = overlay.querySelector('[role="dialog"]');
    dialog.setAttribute('aria-label', '保存任务配置');
    let settled = false;
    const settle = choice => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      overlay.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      UI.closeModal();
      if (choice === 'stay' && previousFocus?.isConnected) previousFocus.focus();
      resolve(choice);
    };
    const onClick = event => {
      const choice = event.target.closest('[data-unsaved-choice]')?.dataset.unsavedChoice;
      if (choice) settle(choice);
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); settle('stay'); }
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const observer = new window.MutationObserver(() => {
      if (!overlay.classList.contains('open') || !dialog.isConnected) settle('stay');
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'], childList: true });
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    dialog.querySelector('[data-unsaved-choice="stay"]').focus();
  });
}
