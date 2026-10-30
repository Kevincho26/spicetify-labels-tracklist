// A single shared tooltip for labels.
//
// Spicetify's Tippy tooltips render without their theme on Spotify 1.3, so the
// text ends up floating over the covers. This one has a solid background, is
// positioned in the viewport, and works through event delegation, so labels
// that get re-rendered need no cleanup.

const ATTRIBUTE = 'data-spicetify-playlist-labels-tooltip';
const SHOW_DELAY = 350;
// Moving between labels within this time shows the next tooltip at once.
const SKIP_DELAY_WINDOW = 500;
const OFFSET = 8;
const MARGIN = 8;

let tooltip: HTMLElement | null = null;
let anchor: HTMLElement | null = null;
let showTimer = 0;
let lastVisibleAt = 0;

export function setTooltip(element: HTMLElement, text: string) {
    element.setAttribute(ATTRIBUTE, text);
}

function getTooltip() {
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'spicetify-playlist-labels-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        document.body.append(tooltip);
    }
    return tooltip;
}

function show(element: HTMLElement) {
    if (!element.isConnected) return;
    const box = getTooltip();
    box.textContent = element.getAttribute(ATTRIBUTE);
    box.classList.remove('spicetify-playlist-labels-tooltip-visible');
    box.style.display = 'block';

    const target = element.getBoundingClientRect();
    const size = box.getBoundingClientRect();
    let top = target.top - size.height - OFFSET;
    let placement = 'top';
    if (top < MARGIN) {
        top = target.bottom + OFFSET;
        placement = 'bottom';
    }
    const left = Math.min(
        Math.max(MARGIN, target.left + target.width / 2 - size.width / 2),
        window.innerWidth - size.width - MARGIN,
    );
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
    box.dataset.placement = placement;

    // Next frame, so the fade-in starts from the hidden state.
    requestAnimationFrame(() => {
        if (anchor === element) box.classList.add('spicetify-playlist-labels-tooltip-visible');
    });
}

function scheduleShow(element: HTMLElement) {
    clearTimeout(showTimer);
    anchor = element;
    const delay = Date.now() - lastVisibleAt < SKIP_DELAY_WINDOW ? 0 : SHOW_DELAY;
    showTimer = window.setTimeout(() => show(element), delay);
}

export function hideTooltip() {
    clearTimeout(showTimer);
    if (anchor && tooltip?.classList.contains('spicetify-playlist-labels-tooltip-visible')) lastVisibleAt = Date.now();
    anchor = null;
    if (!tooltip) return;
    tooltip.classList.remove('spicetify-playlist-labels-tooltip-visible');
    tooltip.style.display = 'none';
}

function tooltipTarget(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLElement>(`[${ATTRIBUTE}]`) : null;
}

export function installTooltips() {
    document.addEventListener('pointerover', (event) => {
        const element = tooltipTarget(event.target);
        if (element && element !== anchor) scheduleShow(element);
    });
    document.addEventListener('pointerout', (event) => {
        if (!anchor) return;
        const next = event.relatedTarget;
        if (!(next instanceof Node && anchor.contains(next))) hideTooltip();
    });
    document.addEventListener('focusin', (event) => {
        const element = tooltipTarget(event.target);
        if (element?.matches(':focus-visible')) scheduleShow(element);
    });
    document.addEventListener('focusout', () => hideTooltip());
    document.addEventListener('pointerdown', () => hideTooltip(), true);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideTooltip();
    }, true);
    document.addEventListener('scroll', () => hideTooltip(), true);
    document.addEventListener('wheel', () => hideTooltip(), { capture: true, passive: true });
    window.addEventListener('blur', () => hideTooltip());
}

// Hides the tooltip when its label was removed by a re-render.
export function hideDetachedTooltip() {
    if (anchor && !anchor.isConnected) hideTooltip();
}
