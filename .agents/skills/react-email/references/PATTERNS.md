# Common Email Patterns

Real-world examples of common email templates using React Email with Tailwind CSS styling.

## Password Reset Email

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  pixelBasedPreset,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";

interface PasswordResetProps {
  resetUrl: string;
  email: string;
  expiryHours?: number;
}

export default function PasswordReset({
  resetUrl,
  email,
  expiryHours = 1,
}: PasswordResetProps) {
  return (
    <Html lang="en">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>Reset your password - Action required</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-xl bg-white px-5 py-10">
            <Heading className="mb-5 text-2xl font-bold text-gray-800">
              Reset Your Password
            </Heading>
            <Text className="my-4 text-base leading-7 text-gray-800">
              A password reset was requested for your account:{" "}
              <strong>{email}</strong>
            </Text>
            <Text className="my-4 text-base leading-7 text-gray-800">
              Click the button below to reset your password. This link expires
              in {expiryHours} hour{expiryHours > 1 ? "s" : ""}.
            </Text>
            <Button
              href={resetUrl}
              className="my-6 block rounded bg-red-600 px-7 py-3.5 text-center font-bold text-white no-underline"
            >
              Reset Password
            </Button>
            <Hr className="my-6 border-gray-200" />
            <Text className="my-2 text-sm leading-5 text-gray-500">
              If you didn't request this, please ignore this email. Your
              password will remain unchanged.
            </Text>
            <Text className="my-2 text-sm leading-5 text-gray-500">
              For security, this link will only work once.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

PasswordReset.PreviewProps = {
  resetUrl: "https://example.com/reset/abc123",
  email: "user@example.com",
  expiryHours: 1,
} as PasswordResetProps;
```

## Order Confirmation with Product List

```tsx
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  pixelBasedPreset,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface Product {
  name: string;
  price: number;
  quantity: number;
  image: string;
  sku?: string;
}

interface OrderConfirmationProps {
  orderNumber: string;
  orderDate: Date;
  items: Product[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export default function OrderConfirmation({
  orderNumber,
  orderDate,
  items,
  subtotal,
  shipping,
  tax,
  total,
  shippingAddress,
}: OrderConfirmationProps) {
  return (
    <Html lang="en">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>
          Order #{orderNumber} confirmed - Thank you for your purchase!
        </Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-xl px-5 py-10">
            <Heading className="mb-2 text-3xl font-bold text-gray-800">
              Order Confirmed
            </Heading>
            <Text className="mb-6 text-base text-gray-500">
              Thank you for your order!
            </Text>

            <Section className="mb-6 rounded bg-gray-50 p-4">
              <Row>
                <Column>
                  <Text className="mb-1 text-xs uppercase text-gray-500">
                    Order Number
                  </Text>
                  <Text className="m-0 text-base font-bold text-gray-800">
                    #{orderNumber}
                  </Text>
                </Column>
                <Column>
                  <Text className="mb-1 text-xs uppercase text-gray-500">
                    Order Date
                  </Text>
                  <Text className="m-0 text-base font-bold text-gray-800">
                    {orderDate.toLocaleDateString()}
                  </Text>
                </Column>
              </Row>
            </Section>

            <Hr className="my-6 border-gray-200" />

            <Heading as="h2" className="my-4 text-xl font-bold text-gray-800">
              Order Items
            </Heading>

            {items.map((item, index) => (
              <Section key={index} className="mb-4">
                <Row>
                  <Column className="w-20 align-top">
                    <Img
                      src={item.image}
                      alt={item.name}
                      width="80"
                      height="80"
                      className="rounded border border-gray-200"
                    />
                  </Column>
                  <Column className="pl-4 align-top">
                    <Text className="m-0 mb-1 text-base font-bold text-gray-800">
                      {item.name}
                    </Text>
                    {item.sku && (
                      <Text className="m-0 mb-2 text-sm text-gray-400">
                        SKU: {item.sku}
                      </Text>
                    )}
                    <Text className="m-0 text-sm text-gray-500">
                      Quantity: {item.quantity} × ${item.price.toFixed(2)}
                    </Text>
                  </Column>
                  <Column className="w-24 text-right align-top">
                    <Text className="m-0 text-base font-bold text-gray-800">
                      ${(item.quantity * item.price).toFixed(2)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}

            <Hr className="my-6 border-gray-200" />

            <Section className="mt-6">
              <Row>
                <Column>
                  <Text className="my-2 text-sm text-gray-500">Subtotal</Text>
                </Column>
                <Column className="text-right">
                  <Text className="my-2 text-sm text-gray-800">
                    ${subtotal.toFixed(2)}
                  </Text>
                </Column>
              </Row>
              <Row>
                <Column>
                  <Text className="my-2 text-sm text-gray-500">Shipping</Text>
                </Column>
                <Column className="text-right">
                  <Text className="my-2 text-sm text-gray-800">
                    ${shipping.toFixed(2)}
                  </Text>
                </Column>
              </Row>
              <Row>
                <Column>
                  <Text className="my-2 text-sm text-gray-500">Tax</Text>
                </Column>
                <Column className="text-right">
                  <Text className="my-2 text-sm text-gray-800">
                    ${tax.toFixed(2)}
                  </Text>
                </Column>
              </Row>
              <Hr className="my-3 border-gray-200" />
              <Row>
                <Column>
                  <Text className="my-2 text-lg font-bold text-gray-800">
                    Total
                  </Text>
                </Column>
                <Column className="text-right">
                  <Text className="my-2 text-lg font-bold text-gray-800">
                    ${total.toFixed(2)}
                  </Text>
                </Column>
              </Row>
            </Section>

            <Hr className="my-6 border-gray-200" />

            <Heading as="h2" className="my-4 text-xl font-bold text-gray-800">
              Shipping Address
            </Heading>
            <Section className="rounded bg-gray-50 p-4">
              <Text className="my-1 text-sm text-gray-800">
                {shippingAddress.name}
              </Text>
              <Text className="my-1 text-sm text-gray-800">
                {shippingAddress.street}
              </Text>
              <Text className="my-1 text-sm text-gray-800">
                {shippingAddress.city}, {shippingAddress.state}{" "}
                {shippingAddress.zip}
              </Text>
              <Text className="my-1 text-sm text-gray-800">
                {shippingAddress.country}
              </Text>
            </Section>

            <Text className="mt-8 text-sm text-gray-500">
              Questions about your order? Reply to this email and we'll help you
              out.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

OrderConfirmation.PreviewProps = {
  orderNumber: "10234",
  orderDate: new Date(),
  items: [
    {
      name: "Vintage Macintosh",
      price: 499.0,
      quantity: 1,
      image: "https://via.placeholder.com/80",
      sku: "MAC-001",
    },
    {
      name: "Mechanical Keyboard",
      price: 149.99,
      quantity: 2,
      image: "https://via.placeholder.com/80",
      sku: "KEY-042",
    },
  ],
  subtotal: 798.98,
  shipping: 15.0,
  tax: 69.42,
  total: 883.4,
  shippingAddress: {
    name: "John Doe",
    street: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    country: "USA",
  },
} as OrderConfirmationProps;
```

## Notification Email with Code Block

```tsx
import {
  Body,
  CodeBlock,
  Container,
  dracula,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  pixelBasedPreset,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface NotificationProps {
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  timestamp: Date;
  logData?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export default function Notification({
  title,
  message,
  severity,
  timestamp,
  logData,
  actionUrl,
  actionLabel = "View Details",
}: NotificationProps) {
  const severityColors = {
    info: "bg-sky-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    success: "bg-green-500",
  };

  const severityBtnColors = {
    info: "bg-sky-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    success: "bg-green-500",
  };

  return (
    <Html lang="en">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>
          {title} - {severity}
        </Preview>
        <Body className="bg-gray-100 font-mono">
          <Container className="mx-auto max-w-xl overflow-hidden rounded border border-gray-200 bg-white">
            <Section className={`h-1 w-full ${severityColors[severity]}`} />

            <Heading className="mx-6 mb-4 mt-6 text-2xl font-bold text-gray-800">
              {title}
            </Heading>

            <Text
              className={`mx-6 mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${severityBtnColors[severity]}`}
            >
              {severity.toUpperCase()}
            </Text>

            <Text className="mx-6 mb-4 text-base leading-6 text-gray-800">
              {message}
            </Text>

            <Text className="mx-6 mb-6 text-sm text-gray-500">
              {new Date(timestamp).toLocaleString("en-US", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </Text>

            {logData && (
              <>
                <Hr className="my-6 border-gray-200" />
                <Heading
                  as="h2"
                  className="mx-6 my-4 text-lg font-bold text-gray-800"
                >
                  Log Details
                </Heading>
                <Section className="mx-6">
                  <CodeBlock
                    code={logData}
                    language="json"
                    theme={dracula}
                    lineNumbers
                  />
                </Section>
              </>
            )}

            {actionUrl && (
              <>
                <Hr className="my-6 border-gray-200" />
                <Link
                  href={actionUrl}
                  className={`mx-6 mb-6 inline-block rounded px-6 py-3 text-base font-bold text-white no-underline ${severityBtnColors[severity]}`}
                >
                  {actionLabel}
                </Link>
              </>
            )}

            <Hr className="my-6 border-gray-200" />
            <Text className="mx-6 mb-6 text-xs text-gray-500">
              This is an automated notification. Please do not reply to this
              email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

Notification.PreviewProps = {
  title: "Deployment Failed",
  message:
    "The deployment to production environment has failed. Please review the logs and take corrective action.",
  severity: "error",
  timestamp: new Date(),
  logData: `{
  "error": "Build failed",
  "exit_code": 1,
  "duration": "2m 34s",
  "commit": "abc123def"
}`,
  actionUrl: "https://example.com/deployments/123",
  actionLabel: "View Deployment",
} as NotificationProps;
```

## Multi-Column Newsletter

```tsx
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  pixelBasedPreset,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface Article {
  title: string;
  excerpt: string;
  image: string;
  url: string;
  author: string;
  date: string;
}

interface NewsletterProps {
  articles: Article[];
  unsubscribeUrl: string;
}

export default function Newsletter({
  articles,
  unsubscribeUrl,
}: NewsletterProps) {
  return (
    <Html lang="en">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>Your weekly roundup of the latest articles</Preview>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-xl">
            {/* Header */}
            <Section className="px-5 pb-5 pt-10 text-center">
              <Img
                src="https://via.placeholder.com/150x50?text=Logo"
                alt="Company Logo"
                width="150"
                height="50"
              />
            </Section>

            <Heading className="mx-5 mb-4 text-center text-3xl font-bold text-gray-900">
              This Week's Highlights
            </Heading>
            <Text className="mx-5 mb-6 text-center text-base leading-6 text-gray-500">
              Here are the top articles from this week. Enjoy your reading!
            </Text>

            <Hr className="mx-5 my-8 border-gray-200" />

            {/* Featured Article */}
            {articles[0] && (
              <Section className="px-5">
                <Img
                  src={articles[0].image}
                  alt={articles[0].title}
                  width="600"
                  className="mb-4 w-full rounded-lg"
                />
                <Heading
                  as="h2"
                  className="my-4 text-2xl font-bold text-gray-900"
                >
                  {articles[0].title}
                </Heading>
                <Text className="my-4 text-base leading-6 text-gray-500">
                  {articles[0].excerpt}
                </Text>
                <Text className="my-2 text-sm text-gray-400">
                  By {articles[0].author} • {articles[0].date}
                </Text>
                <Button
                  href={articles[0].url}
                  className="inline-block rounded bg-blue-600 px-6 py-3 font-bold text-white no-underline"
                >
                  Read More
                </Button>
              </Section>
            )}

            <Hr className="mx-5 my-8 border-gray-200" />

            {/* Two-Column Articles */}
            {articles.slice(1, 5).length > 0 && (
              <>
                <Heading
                  as="h2"
                  className="mx-5 my-4 text-2xl font-bold text-gray-900"
                >
                  More From This Week
                </Heading>
                {Array.from({
                  length: Math.ceil(articles.slice(1, 5).length / 2),
                }).map((_, rowIndex) => {
                  const leftArticle = articles[1 + rowIndex * 2];
                  const rightArticle = articles[2 + rowIndex * 2];

                  return (
                    <Section key={rowIndex} className="mb-6 px-5">
                      <Row>
                        {leftArticle && (
                          <Column className="w-1/2 px-1 align-top">
                            <Img
                              src={leftArticle.image}
                              alt={leftArticle.title}
                              width="280"
                              className="mb-3 w-full rounded"
                            />
                            <Heading
                              as="h3"
                              className="my-3 text-lg font-bold text-gray-900"
                            >
                              {leftArticle.title}
                            </Heading>
                            <Text className="my-2 text-sm leading-5 text-gray-500">
                              {leftArticle.excerpt}
                            </Text>
                            <Link
                              href={leftArticle.url}
                              className="text-sm font-semibold text-blue-600 no-underline"
                            >
                              Read article →
                            </Link>
                          </Column>
                        )}

                        {rightArticle && (
                          <Column className="w-1/2 px-1 align-top">
                            <Img
                              src={rightArticle.image}
                              alt={rightArticle.title}
                              width="280"
                              className="mb-3 w-full rounded"
                            />
                            <Heading
                              as="h3"
                              className="my-3 text-lg font-bold text-gray-900"
                            >
                              {rightArticle.title}
                            </Heading>
                            <Text className="my-2 text-sm leading-5 text-gray-500">
                              {rightArticle.excerpt}
                            </Text>
                            <Link
                              href={rightArticle.url}
                              className="text-sm font-semibold text-blue-600 no-underline"
                            >
                              Read article →
                            </Link>
                          </Column>
                        )}
                      </Row>
                    </Section>
                  );
                })}
              </>
            )}

            <Hr className="mx-5 my-8 border-gray-200" />

            {/* Footer */}
            <Section className="mt-8 bg-gray-50 p-8 text-center">
              <Text className="my-2 text-sm text-gray-500">
                You're receiving this because you subscribed to our newsletter.
              </Text>
              <Link
                href={unsubscribeUrl}
                className="my-2 block text-sm text-blue-600 underline"
              >
                Unsubscribe from this list
              </Link>
              <Text className="my-2 text-sm text-gray-500">
                © 2026 Company Name. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

Newsletter.PreviewProps = {
  articles: [
    {
      title: "The Future of Web Development in 2026",
      excerpt:
        "Exploring the latest trends and technologies shaping modern web development.",
      image: "https://via.placeholder.com/600x300",
      url: "https://example.com/article-1",
      author: "Jane Doe",
      date: "Jan 15, 2026",
    },
    {
      title: "React Server Components Explained",
      excerpt: "A deep dive into React Server Components and their benefits.",
      image: "https://via.placeholder.com/280x140",
      url: "https://example.com/article-2",
      author: "John Smith",
      date: "Jan 14, 2026",
    },
    {
      title: "Building Accessible Web Apps",
      excerpt: "Best practices for creating inclusive digital experiences.",
      image: "https://via.placeholder.com/280x140",
      url: "https://example.com/article-3",
      author: "Sarah Johnson",
      date: "Jan 13, 2026",
    },
  ],
  unsubscribeUrl: "https://example.com/unsubscribe",
} as NewsletterProps;
```

## Team Invitation Email

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  pixelBasedPreset,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface TeamInvitationProps {
  inviterName: string;
  inviterEmail: string;
  teamName: string;
  role: string;
  inviteUrl: string;
  expiryDays: number;
}

export default function TeamInvitation({
  inviterName,
  inviterEmail,
  teamName,
  role,
  inviteUrl,
  expiryDays,
}: TeamInvitationProps) {
  return (
    <Html lang="en">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>You've been invited to join {teamName}</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-xl bg-white px-5 py-10">
            <Heading className="mb-6 text-center text-3xl font-bold text-gray-800">
              You're Invited!
            </Heading>

            <Text className="my-4 text-base leading-7 text-gray-800">
              <strong>{inviterName}</strong> ({inviterEmail}) has invited you to
              join the <strong>{teamName}</strong> team.
            </Text>

            <Section className="my-6 rounded border border-gray-200 bg-gray-50 p-5">
              <Text className="mb-2 text-xs font-bold uppercase text-gray-500">
                Role
              </Text>
              <Text className="m-0 text-lg font-bold text-gray-800">
                {role}
              </Text>
            </Section>

            <Text className="my-4 text-base leading-7 text-gray-800">
              Click the button below to accept the invitation and get started.
            </Text>

            <Button
              href={inviteUrl}
              className="my-6 block rounded bg-green-600 px-7 py-3.5 text-center text-base font-bold text-white no-underline"
            >
              Accept Invitation
            </Button>

            <Hr className="my-6 border-gray-200" />

            <Text className="my-2 text-sm leading-5 text-gray-500">
              This invitation will expire in {expiryDays} day
              {expiryDays > 1 ? "s" : ""}.
            </Text>
            <Text className="my-2 text-sm leading-5 text-gray-500">
              If you weren't expecting this invitation, you can safely ignore
              this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

TeamInvitation.PreviewProps = {
  inviterName: "John Doe",
  inviterEmail: "john@example.com",
  teamName: "Acme Corp Engineering",
  role: "Developer",
  inviteUrl: "https://example.com/invite/abc123",
  expiryDays: 7,
} as TeamInvitationProps;
```

These patterns demonstrate:

- Tailwind CSS utility classes for styling
- Proper component usage with `pixelBasedPreset`
- TypeScript typing
- Preview props for testing
- Responsive layouts
- Common email scenarios
