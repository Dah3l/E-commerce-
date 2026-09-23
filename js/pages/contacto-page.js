import { showToast, escapeHtml, renderSiteHeader, renderSiteFooter, initScrollTopButton } from '../ui.js';
import { getBizConfig, getWhatsAppNumber } from '../config-negocio.js';

let bizConfig = {};

async function loadContactInfo() {
const container = document.getElementById('contactInfo');
try {
bizConfig = await getBizConfig();
} catch (_) { bizConfig = {}; }

const c = bizConfig || {};
const phone = getWhatsAppNumber(c);
const rows = [
['📞', 'Teléfono', c.telefono],
['💬', 'WhatsApp', c.whatsapp ? (phone ? `<a href="https://wa.me/${phone}" target="_blank" rel="noopener">${escapeHtml(c.whatsapp)}</a>` : escapeHtml(c.whatsapp)) : null],
['✉️', 'Email', c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : null],
['📍', 'Dirección', c.direccion],
['🕐', 'Horario', c.horario]
];

container.innerHTML = rows.map(([icon, title, value]) => `
<div class="contact-card">
<div class="contact-card__icon">${icon}</div>
<div class="contact-card__content">
<h3>${title}</h3>
<p>${value || 'No disponible'}</p>
</div>
</div>
`).join('');

// Actualizar hint del formulario según lo configurado
const hint = document.getElementById('formHint');
const btn = document.getElementById('cfSubmit');
if (phone) {
hint.textContent = 'Tu mensaje se abrirá en WhatsApp listo para enviar.';
btn.textContent = 'Enviar por WhatsApp';
} else if (c.email) {
hint.textContent = 'Tu mensaje se abrirá en tu aplicación de correo.';
btn.textContent = 'Enviar Email';
} else {
hint.textContent = 'Aún no hay WhatsApp ni email configurados en la tienda.';
btn.disabled = true;
}
}

// Envío real: WhatsApp si hay número; si no, mailto; si no, aviso claro
document.getElementById('contactForm').addEventListener('submit', (e) => {
e.preventDefault();
const nombre = document.getElementById('cfNombre').value.trim();
const email = document.getElementById('cfEmail').value.trim();
const mensaje = document.getElementById('cfMensaje').value.trim();
if (!nombre || !mensaje) return;

const c = bizConfig || {};
const phone = getWhatsAppNumber(c);
const body = [
`¡Hola${c.nombre_negocio ? ' ' + c.nombre_negocio : ''}! 👋`,
`Me llamo ${nombre}.`,
'',
mensaje,
email ? `\n(Email de contacto: ${email})` : ''
].join('\n');

if (phone) {
window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, '_blank');
showToast('Se abrió WhatsApp con tu mensaje listo para enviar', 'success');
} else if (c.email) {
window.location.href = `mailto:${c.email}?subject=${encodeURIComponent('Contacto web: ' + nombre)}&body=${encodeURIComponent(body)}`;
} else {
showToast('La tienda no tiene WhatsApp ni email configurados', 'error');
return;
}
e.target.reset();
});

async function init() {
initScrollTopButton();
await loadContactInfo();
// Header SIEMPRE visible (logo real + carrito + hamburguesa)
renderSiteHeader('contacto', bizConfig);
renderSiteFooter(bizConfig);
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', init);
} else {
init();
}
