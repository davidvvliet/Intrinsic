import { getSignUpUrl } from '@workos-inc/authkit-nextjs';

export async function GET() {
  try {
    const signUpUrl = await getSignUpUrl();

    return new Response(null, {
      status: 302,
      headers: {
        Location: signUpUrl,
      },
    });
  } catch (error) {
    console.error('Error generating WorkOS sign-up URL:', error);
    return new Response('Error generating signup URL', { status: 500 });
  }
}
