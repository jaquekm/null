import { describe, expect, it } from "vitest";
import { isPrivateIp } from "./is-private-ip";

describe("isPrivateIp", () => {
  it("bloqueia loopback", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("bloqueia as três faixas RFC1918", () => {
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("bloqueia link-local", () => {
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("bloqueia CGNAT (100.64.0.0/10)", () => {
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.100.0.1")).toBe(true);
  });

  it("bloqueia IPv4 mapeado em IPv6", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("bloqueia unique local IPv6 (fc00::/7)", () => {
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
  });

  it("permite IPs públicos", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });

  it("trata endereço malformado como inseguro", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });

  it("não confunde 172.15/172.32 (fora da faixa privada) com privado", () => {
    expect(isPrivateIp("172.15.0.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });
});
