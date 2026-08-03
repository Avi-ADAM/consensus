<script lang="ts">
	import { _ } from 'svelte-i18n';

	/**
	 * Site-wide footer. Every link here must resolve to a page that exists —
	 * either a route in this app or a live property of the 1💗1 network.
	 * (The brand is written "1💗1"; "1lev1.com" only ever appears as a hostname.)
	 * Placeholder links (`#`) and routes that are not implemented do not belong
	 * here: a dead link in the footer is the cheapest way to lose a visitor.
	 */
	const MAIN_SITE = 'https://www.1lev1.com';
	const AGREEMENT_SITE = 'https://agreement.1lev1.com';
	const SUPPORT_PROJECT = 'https://www.1lev1.com/project/49';

	// String, not number: the ICU formatter would render 2026 as "2,026".
	const year = String(new Date().getFullYear());
</script>

<footer class="site-footer">
	<div class="footer-inner">
		<div class="footer-brand">
			<a href="/" class="logo">
				<img src="/logo.png" alt="" class="logo-img" width="34" height="34" />
				<span class="logo-text">Consensus</span>
			</a>
			<p>{$_('footer.description')}</p>
			<a class="support-link" href={SUPPORT_PROJECT} target="_blank" rel="noopener noreferrer">
				<span aria-hidden="true">♥</span>
				<span>
					<strong>{$_('footer.support')}</strong>
					<em>{$_('footer.supportHint')}</em>
				</span>
			</a>
		</div>

		<div class="footer-links">
			<div class="footer-col">
				<h4>{$_('footer.product')}</h4>
				<a href="/negotiation/local">{$_('footer.map')}</a>
				<a href="/negotiation/new">{$_('footer.newDiscussion')}</a>
			</div>
			<div class="footer-col">
				<h4>{$_('footer.network')}</h4>
				<a href={MAIN_SITE} target="_blank" rel="noopener noreferrer">
					{$_('footer.mainSite')}
					<span class="host">www.1lev1.com</span>
				</a>
				<a href={AGREEMENT_SITE} target="_blank" rel="noopener noreferrer">
					{$_('footer.agreement')}
					<span class="host">agreement.1lev1.com</span>
				</a>
			</div>
		</div>
	</div>

	<div class="footer-bottom">
		<span class="rights">{$_('footer.rights', { values: { year } })}</span>
		<span class="dot" aria-hidden="true">·</span>
		<span>{$_('footer.partOf')}</span>
	</div>
</footer>

<style>
	.site-footer {
		background: #07070d;
		border-top: 1px solid #ffffff08;
		/* The bottom padding also keeps the floating language switcher
		   (fixed, bottom-left in +layout.svelte) off the copyright line. */
		padding: 4rem 0 4.5rem;
		font-family: 'Sora', sans-serif;
	}

	.footer-inner {
		max-width: 1280px;
		margin: 0 auto 3rem;
		padding: 0 2rem;
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 4rem;
	}

	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
	}

	.logo-img {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		object-fit: contain;
	}

	.logo-text {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #f0f0f8;
	}

	.footer-brand p {
		font-size: 0.9rem;
		color: #7070a0;
		margin: 0.8rem 0 1.2rem;
		line-height: 1.6;
		max-width: 42ch;
	}

	.support-link {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 1.1rem;
		border: 1px solid #7c3aed55;
		border-radius: 12px;
		background: linear-gradient(135deg, #7c3aed18, transparent);
		text-decoration: none;
		transition:
			border-color 0.2s,
			background 0.2s;
	}

	.support-link:hover {
		border-color: #7c3aed;
		background: linear-gradient(135deg, #7c3aed2e, transparent);
	}

	.support-link > [aria-hidden] {
		font-size: 1.1rem;
		color: #c4b5fd;
		line-height: 1;
	}

	.support-link strong {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e6e0ff;
	}

	.support-link em {
		display: block;
		font-style: normal;
		font-size: 0.76rem;
		color: #7070a0;
		margin-top: 0.15rem;
	}

	.footer-links {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2rem;
	}

	.footer-col {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.footer-col h4 {
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #505080;
		margin-bottom: 0.4rem;
	}

	.footer-col a {
		font-size: 0.88rem;
		color: #7070a0;
		text-decoration: none;
		transition: color 0.2s;
	}

	.footer-col a:hover {
		color: #c4b5fd;
	}

	.host {
		display: block;
		font-size: 0.72rem;
		color: #4a4a6a;
		direction: ltr;
		unicode-bidi: isolate;
		margin-top: 0.1rem;
	}

	/* "© 2026 consensus.1lev1.com" is a Latin run; without isolation the RTL
	   layout reorders it to "consensus.1lev1.com 2026 ©". */
	.rights {
		direction: ltr;
		unicode-bidi: isolate;
	}

	.footer-bottom {
		max-width: 1280px;
		margin: 0 auto;
		padding: 1.5rem 2rem 0;
		border-top: 1px solid #ffffff08;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		font-size: 0.82rem;
		color: #4a4a6a;
	}

	@media (max-width: 1200px) {
		.footer-inner {
			grid-template-columns: 1fr;
			gap: 2.5rem;
		}
	}

	@media (max-width: 640px) {
		.footer-inner {
			padding: 0 1.25rem;
		}
		.footer-links {
			gap: 1.5rem;
		}
	}
</style>
