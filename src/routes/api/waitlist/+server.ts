import { json } from '@sveltejs/kit';
import { Resend } from 'resend';
import { RESEND_API_KEY, RESEND_AUDIENCE_ID } from '$env/static/private';
import type { RequestHandler } from './$types';

const resend = new Resend(RESEND_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email } = await request.json();

		// Validate email
		if (!email || typeof email !== 'string') {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}

		// Add contact to Resend audience
		const { data, error } = await resend.contacts.create({
			email,
			audienceId: RESEND_AUDIENCE_ID
		});

		if (error) {
			console.error('Resend API error:', error);
			return json({ error: 'Failed to subscribe to waitlist' }, { status: 500 });
		}

		return json({ success: true, data }, { status: 200 });
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
