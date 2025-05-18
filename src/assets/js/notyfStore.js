import { Notyf } from 'notyf';

/**
 * Singleton Notyf instance for notifications.
 * @returns {Notyf}
 */
let notyfInstance = null;
function getNotyf() {
  if (!notyfInstance) {
    notyfInstance = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'bottom' },
      types: [
        {
          type: 'success',
          background: 'var(--color-success)',
          icon: { className: 'icon-[tabler--check]', tagName: 'i' }
        },
        {
          type: 'error',
          background: 'var(--color-error)',
          icon: { className: 'icon-[tabler--alert-circle]', tagName: 'i' }
        },
        {
          type: 'info',
          background: 'var(--color-info)',
          icon: { className: 'icon-[tabler--info-circle]', tagName: 'i' }
        },
        {
          type: 'warning',
          background: 'var(--color-warning)',
          icon: { className: 'icon-[tabler--alert-triangle]', tagName: 'i' }
        }
      ]
    });
  }
  return notyfInstance;
}

/**
 * Register Notyf notification store in Alpine.
 * @param {object} Alpine - The Alpine.js global object
 */
export function registerNotyfStore(Alpine) {
  Alpine.store('notyf', {
    /** Show a success notification */
    success(msg, opts = {}) { return getNotyf().success(msg, opts); },
    /** Show an error notification */
    error(msg, opts = {}) { return getNotyf().error(msg, opts); },
    /** Show an info notification */
    info(msg, opts = {}) { return getNotyf().open({ type: 'info', message: msg, ...opts }); },
    /** Show a warning notification */
    warning(msg, opts = {}) { return getNotyf().open({ type: 'warning', message: msg, ...opts }); },
    /** Dismiss a toast instance */
    dismiss(toast) { return getNotyf().dismiss(toast); }
  });
} 