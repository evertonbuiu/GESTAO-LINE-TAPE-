import { describe, it, expect } from "vitest";
import {
  addDays,
  buildCsv,
  compare,
  csvNumber,
  dateOnly,
  endOfMonth,
  formatDelta,
  formatMonthBR,
  groupTotals,
  inRange,
  maskDocument,
  monthlySeries,
  pageCount,
  paginate,
  previousPeriod,
  resolvePeriod,
  searchRows,
  sortRows,
  startOfMonth,
  sumBy,
  csvFileName,
} from "@/lib/reports";
import { buildPrintHtml } from "@/lib/reportExport";

const REF = "2026-03-15";

describe("períodos (America/Sao_Paulo)", () => {
  it("resolve presets sem deslocar datas", () => {
    expect(resolvePeriod("hoje", undefined, REF)).toEqual({ start: REF, end: REF });
    expect(resolvePeriod("7d", undefined, REF)).toEqual({ start: "2026-03-09", end: REF });
    expect(resolvePeriod("30d", undefined, REF)).toEqual({ start: "2026-02-14", end: REF });
    expect(resolvePeriod("mes", undefined, REF)).toEqual({ start: "2026-03-01", end: "2026-03-31" });
    expect(resolvePeriod("mes_anterior", undefined, REF)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(resolvePeriod("trimestre", undefined, REF)).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    });
    expect(resolvePeriod("ano", undefined, REF)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("usa datas informadas no período personalizado", () => {
    expect(resolvePeriod("custom", { start: "2026-01-05", end: "2026-01-20" }, REF)).toEqual({
      start: "2026-01-05",
      end: "2026-01-20",
    });
  });

  it("calcula período anterior com a mesma duração", () => {
    expect(previousPeriod({ start: "2026-03-01", end: "2026-03-31" })).toEqual({
      start: "2026-01-29",
      end: "2026-02-28",
    });
    expect(previousPeriod({ start: "2026-03-10", end: "2026-03-10" })).toEqual({
      start: "2026-03-09",
      end: "2026-03-09",
    });
  });

  it("trata bissexto e virada de mês/ano", () => {
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(startOfMonth("2026-07-22")).toBe("2026-07-01");
  });

  it("extrai apenas a data de timestamps, sem converter fuso", () => {
    expect(dateOnly("2026-03-15T23:40:00-03:00")).toBe("2026-03-15");
    expect(dateOnly(null)).toBe("");
  });

  it("filtra por intervalo fechado", () => {
    const range = { start: "2026-03-01", end: "2026-03-31" };
    expect(inRange("2026-03-01", range)).toBe(true);
    expect(inRange("2026-03-31T22:00:00Z", range)).toBe(true);
    expect(inRange("2026-04-01", range)).toBe(false);
    expect(inRange(null, range)).toBe(false);
  });
});

describe("cálculos e agregações", () => {
  it("soma sem erro de ponto flutuante", () => {
    expect(sumBy([{ v: 0.1 }, { v: 0.2 }], (r) => r.v)).toBe(0.3);
    expect(sumBy([{ v: null }, { v: 10.55 }], (r) => r.v)).toBe(10.55);
  });

  it("agrupa e ordena do maior para o menor", () => {
    const rows = [
      { cat: "Transporte", v: 100 },
      { cat: "Alimentação", v: 250.5 },
      { cat: "Transporte", v: 50 },
      { cat: "", v: 10 },
    ];
    const groups = groupTotals(rows, (r) => r.cat, (r) => r.v);
    expect(groups[0]).toEqual({ key: "Alimentação", label: "Alimentação", total: 250.5, count: 1 });
    expect(groups[1]).toEqual({ key: "Transporte", label: "Transporte", total: 150, count: 2 });
    expect(groups[2].label).toBe("Sem categoria");
  });

  it("monta série mensal cobrindo todo o período", () => {
    const series = monthlySeries(
      [
        { date: "2026-01-10", amount: 1000, type: "income" },
        { date: "2026-02-05", amount: 300, type: "expense" },
        { date: "2026-05-05", amount: 999, type: "expense" }, // fora do período
      ],
      { start: "2026-01-01", end: "2026-03-31" },
    );
    expect(series.map((s) => s.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(series[0].entrada).toBe(1000);
    expect(series[1].saida).toBe(300);
    expect(series[1].saldo).toBe(-300);
    expect(series[2].entrada).toBe(0);
    expect(formatMonthBR("2026-02")).toBe("fev/26");
  });

  it("compara com o período anterior", () => {
    const up = compare(150, 100);
    expect(up.delta).toBe(50);
    expect(up.deltaPercent).toBe(50);
    expect(up.direction).toBe("up");

    const down = compare(80, 100);
    expect(down.direction).toBe("down");
    expect(formatDelta(down)).toBe("-20% vs. período anterior");

    const noBase = compare(80, 0);
    expect(noBase.deltaPercent).toBeNull();
    expect(formatDelta(noBase)).toBe("sem base anterior");
  });
});

describe("busca, ordenação e paginação", () => {
  const rows = [
    { id: "1", nome: "João Álvares", valor: 30 },
    { id: "2", nome: "Maria Souza", valor: 120 },
    { id: "3", nome: "Ana Lima", valor: 75 },
  ];

  it("busca ignorando acentos e caixa, exigindo todos os termos", () => {
    expect(searchRows(rows, "joao", ["nome"]).map((r) => r.id)).toEqual(["1"]);
    expect(searchRows(rows, "ALVARES joao", ["nome"]).map((r) => r.id)).toEqual(["1"]);
    expect(searchRows(rows, "zzz", ["nome"])).toHaveLength(0);
    expect(searchRows(rows, "  ", ["nome"])).toHaveLength(3);
  });

  it("ordena números e textos", () => {
    expect(sortRows(rows, "valor", "desc").map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(sortRows(rows, "nome", "asc").map((r) => r.id)).toEqual(["3", "1", "2"]);
  });

  it("pagina com limites seguros", () => {
    expect(paginate(rows, 1, 2).map((r) => r.id)).toEqual(["1", "2"]);
    expect(paginate(rows, 2, 2).map((r) => r.id)).toEqual(["3"]);
    expect(paginate(rows, 99, 2).map((r) => r.id)).toEqual(["3"]);
    expect(paginate(rows, 0, 2).map((r) => r.id)).toEqual(["1", "2"]);
    expect(pageCount(3, 2)).toBe(2);
    expect(pageCount(0, 20)).toBe(1);
  });
});

describe("exportação CSV pt-BR", () => {
  it("usa vírgula decimal", () => {
    expect(csvNumber(1234.5)).toBe("1234,50");
    expect(csvNumber(null)).toBe("0,00");
  });

  it("gera cabeçalho, separador ; e escape de aspas/quebras", () => {
    const csv = buildCsv(
      [{ desc: 'Cabo "XLR"; 10m', v: 99.9 }],
      [
        { key: "desc", label: "Descrição", value: (r) => r.desc },
        { key: "v", label: "Valor", value: (r) => csvNumber(r.v) },
      ],
    );
    const [header, line] = csv.split("\r\n");
    expect(header).toBe("Descrição;Valor");
    expect(line).toBe('"Cabo ""XLR""; 10m";99,90');
  });

  it("nomeia o arquivo com o período", () => {
    expect(csvFileName("relatorio-despesas", { start: "2026-03-01", end: "2026-03-31" })).toBe(
      "relatorio-despesas-2026-03-01-a-2026-03-31.csv",
    );
  });
});

describe("impressão e dados sensíveis", () => {
  it("gera HTML A4 com período e escapa conteúdo", () => {
    const html = buildPrintHtml(
      "Relatório geral",
      { start: "2026-03-01", end: "2026-03-31" },
      [{ label: "Receita", value: "R$ 1.000,00" }],
      { columns: [{ label: "Evento" }, { label: "Valor", numeric: true }], rows: [["<b>Show</b>", "R$ 10,00"]] },
    );
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("01/03/2026 a 31/03/2026");
    expect(html).toContain("&lt;b&gt;Show&lt;/b&gt;");
    expect(html).toContain("display: table-header-group");
  });

  it("mascara documentos", () => {
    expect(maskDocument("123.456.789-09")).toBe("***8909");
    expect(maskDocument(null)).toBe("—");
  });
});
