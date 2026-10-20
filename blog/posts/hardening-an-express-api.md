**HustleHub+** is a freelancer marketplace I built with a React frontend and an Express REST API over MongoDB. Because it handles accounts, bookings and (simulated) payments, I wanted security to be part of the design rather than something bolted on at the end.

This post walks through the layers I used and the reason for each one.

## 1. Structure first: middleware, controllers, services

Security is easier when the code has clear layers. The API is split into:

- **middleware** for cross-cutting concerns such as auth, validation and rate limiting,
- **controllers** that handle the HTTP request and response,
- **services** that hold the business logic and talk to MongoDB through Mongoose.

With that structure, protecting a route is a matter of adding middleware in front of it rather than repeating checks inside every handler.

## 2. Passwords: bcrypt, never plain text

Passwords are hashed with bcrypt before they are stored. bcrypt is deliberately slow and salts each hash, so even if the database leaked, the passwords would be expensive to crack.

```js
const hash = await bcrypt.hash(password, 12);
const ok = await bcrypt.compare(attempt, user.passwordHash);
```

## 3. Authentication: JWT

After login, the API issues a signed JSON Web Token. Protected routes verify the token in middleware and attach the user to the request. Keeping the secret in environment variables, and tokens short-lived, limits the damage if one is exposed.

## 4. Authorisation: roles

Being logged in isn't the same as being allowed. HustleHub+ has three roles (Client, Freelancer and Admin), and each route declares which roles may use it:

```js
router.post('/gigs', requireAuth, requireRole('Freelancer'), createGig);
router.get('/admin/users', requireAuth, requireRole('Admin'), listUsers);
```

## 5. HTTP hardening: Helmet

Helmet sets sensible security headers in one line, covering things like content-type sniffing and clickjacking protection. It's a cheap win.

## 6. Rate limiting

Login and other sensitive endpoints are rate limited, which slows down brute-force attempts and protects the API from being hammered.

## 7. Input sanitisation and NoSQL injection

MongoDB queries can be manipulated if user input containing operators like `$gt` is passed straight into a query. Sanitising request bodies and validating input types closes that gap.

## Testing the protections

Security that isn't tested tends to quietly break. I used:

- **Jest + Supertest** to hit API routes and check that unauthenticated or wrong-role requests are rejected,
- **Vitest** on the React side,
- **Postman collections run with Newman** for repeatable end-to-end API checks.

## Takeaway

No single technique makes an API secure. It's the combination (hashing, tokens, roles, headers, rate limits, sanitisation and tests) that gives you defence in depth.
