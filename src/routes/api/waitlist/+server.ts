import { json } from '@sveltejs/kit';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

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

		// Initialize Resend client
		const resend = new Resend(env.RESEND_API_KEY);

		// Check if email already exists in the audience
		try {
			const { data: contacts } = await resend.contacts.list({
				audienceId: env.RESEND_AUDIENCE_ID!
			});

			if (contacts) {
				const existingContact = contacts.data.find((contact: any) => contact.email === email);
				if (existingContact) {
					console.log('Contact already exists:', email);
					return json(
						{ error: 'already-exists' },
						{ status: 400 }
					);
				}
			}
		} catch (error) {
			console.error('Error checking existing contacts:', error);
			// Continue anyway - we'll handle duplicates later
		}

		// Add contact directly to Resend audience
		console.log('Adding contact:', email, 'to audience:', env.RESEND_AUDIENCE_ID);
		const { data, error } = await resend.contacts.create({
			email,
			audienceId: env.RESEND_AUDIENCE_ID!
		});

		if (error) {
			console.error('Resend API error:', error);
			return json(
				{ error: `Failed to add to waitlist: ${JSON.stringify(error)}` },
				{ status: 500 }
			);
		}

		console.log('Successfully added contact:', data);
		return json({ success: true, message: 'Added to waitlist successfully' }, { status: 200 });
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
