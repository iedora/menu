import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Table, TableRowNum, Td, Th } from "./table";

describe("Table", () => {
  it("renders a <table> with the base class", () => {
    const html = renderToStaticMarkup(
      <Table>
        <tbody>
          <tr>
            <Td>x</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(html).toMatch(/^<table class="ds-table">/);
  });
});

describe("Th", () => {
  it("renders a <th> with the head class and scope='col' by default", () => {
    const html = renderToStaticMarkup(<Th>Work</Th>);
    expect(html).toMatch(/^<th[^>]*scope="col"[^>]*class="ds-table__th"[^>]*>Work<\/th>$/);
  });

  it("respects an explicit scope", () => {
    const html = renderToStaticMarkup(<Th scope="row">Row</Th>);
    expect(html).toContain('scope="row"');
  });
});

describe("Td", () => {
  it("renders a <td> with the body class", () => {
    const html = renderToStaticMarkup(<Td>menu</Td>);
    expect(html).toMatch(/^<td class="ds-table__td">menu<\/td>$/);
  });
});

describe("TableRowNum", () => {
  it("renders a mono row-number cell", () => {
    const html = renderToStaticMarkup(<TableRowNum>01</TableRowNum>);
    expect(html).toMatch(/^<span class="ds-table__n">01<\/span>$/);
  });
});
