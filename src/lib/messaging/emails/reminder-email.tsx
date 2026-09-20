import { Body, Container, Head, Hr, Html, Link, Preview, Text, render } from "react-email";

export interface ReminderEmailProps {
  text: string;
  /** `null` quando não há como montar o link (destinatário é o dono, sem `contact_id`). */
  optOutUrl: string | null;
}

/** Layout simples do e-mail de lembrete (3.9): texto da mensagem + rodapé de opt-out (3.11) quando o destinatário é um contato. */
export function ReminderEmail({ text, optOutUrl }: ReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{text.slice(0, 140)}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "24px", maxWidth: "480px" }}>
          <Text style={{ whiteSpace: "pre-wrap", fontSize: "15px", lineHeight: "1.5", color: "#111111" }}>{text}</Text>
          {optOutUrl && (
            <>
              <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />
              <Text style={{ fontSize: "12px", color: "#888888" }}>
                Não quer mais receber?{" "}
                <Link href={optOutUrl} style={{ color: "#888888", textDecoration: "underline" }}>
                  Clique aqui
                </Link>
                .
              </Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export async function renderReminderEmail(props: ReminderEmailProps): Promise<string> {
  return render(<ReminderEmail {...props} />);
}
