import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDaysText,
  buildFieldsFromChoices,
  buildHoursText,
  buildServicesText,
  createDefaultChoices,
  getBusinessChoices,
  guessCountryKey,
} from "./business-choices.ts";

const base = createDefaultChoices("Europe/Madrid");

describe("opciones del negocio", () => {
  it("agrupa los días seguidos en un rango legible", () => {
    assert.equal(buildDaysText(["mon", "tue", "wed", "thu", "fri"]), "Lunes a viernes");
    assert.equal(buildDaysText(["sat", "sun"]), "Sábado y domingo");
    assert.equal(buildDaysText(["mon", "wed", "fri"]), "Lunes, miércoles y viernes");
    assert.equal(
      buildDaysText(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      "Todos los días",
    );
    assert.equal(buildDaysText([]), "");
  });

  it("escribe el horario a partir de los botones", () => {
    assert.equal(
      buildHoursText({ closeTime: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], openTime: "09:00" }),
      "Lunes a viernes de 09:00 a 18:00",
    );
    assert.equal(buildHoursText({ closeTime: "18:00", days: [], openTime: "09:00" }), "");
  });

  it("junta los servicios marcados con los que el cliente añada", () => {
    assert.equal(
      buildServicesText({
        services: ["Limpieza dental", "Ortodoncia"],
        servicesExtra: " Férulas , ",
      }),
      "Limpieza dental, Ortodoncia, Férulas",
    );
  });

  it("describe la ubicación según cómo atiende", () => {
    const madrid = { city: "Madrid", id: "a", street: "Calle Mayor 1", venue: "Sede Centro" };
    const local = buildFieldsFromChoices({ ...base, locations: [madrid] }, {});
    assert.equal(local.location, "Madrid");
    assert.equal(local.address, "Sede Centro, Calle Mayor 1");

    const domicilio = buildFieldsFromChoices(
      { ...base, attendMode: "domicilio", locations: [{ ...madrid, city: "Sevilla" }] },
      {},
    );
    assert.match(domicilio.location, /Sevilla y alrededores/);

    const online = buildFieldsFromChoices(
      { ...base, attendMode: "online", locations: [madrid] },
      {},
    );
    assert.equal(online.location, "Atención online, sin local físico");
    assert.equal(online.address, "");
  });

  it("admite varios locales y los nombra uno a uno", () => {
    const fields = buildFieldsFromChoices(
      {
        ...base,
        locations: [
          { city: "Madrid", id: "a", street: "Calle Mayor 1", venue: "Sede Centro" },
          { city: "Barcelona", id: "b", street: "Av. Diagonal 20", venue: "Sede Diagonal" },
          { city: "Valencia", id: "c", street: "", venue: "" },
          { city: "", id: "d", street: "Calle sin ciudad 9", venue: "Borrador" },
        ],
      },
      {},
    );

    assert.equal(fields.location, "3 sedes: Madrid, Barcelona y Valencia");
    assert.equal(
      fields.address,
      "Sede Centro: Calle Mayor 1 (Madrid); Sede Diagonal: Av. Diagonal 20 (Barcelona)",
    );
  });

  it("varias zonas a domicilio se listan juntas", () => {
    const fields = buildFieldsFromChoices(
      {
        ...base,
        attendMode: "domicilio",
        locations: [
          { city: "Madrid", id: "a", street: "", venue: "" },
          { city: "Toledo", id: "b", street: "", venue: "" },
        ],
      },
      {},
    );

    assert.equal(
      fields.location,
      "Madrid, Toledo y sus alrededores (vamos donde el cliente)",
    );
  });

  it("lee perfiles antiguos de una sola sede", () => {
    const choices = getBusinessChoices(
      { city: "Madrid", street: "Calle Mayor 1", venue: "Sede Centro" },
      "Europe/Madrid",
    );

    assert.equal(choices.locations.length, 1);
    assert.equal(choices.locations[0].city, "Madrid");
    assert.equal(choices.locations[0].street, "Calle Mayor 1");
    assert.ok(choices.locations[0].id);
  });

  it("no pisa los campos que el wizard no gestiona", () => {
    const fields = buildFieldsFromChoices(base, { team: "Dra. Ana Pérez" });
    assert.equal(fields.team, "Dra. Ana Pérez");
  });

  it("propone país y zona horaria desde el navegador", () => {
    assert.equal(guessCountryKey("America/Bogota"), "CO");
    assert.equal(guessCountryKey("Mars/Olympus"), "");
    assert.equal(createDefaultChoices("America/Bogota").timezone, "America/Bogota");
    // País desconocido: se respeta la zona del navegador tal cual.
    assert.equal(createDefaultChoices("Africa/Lagos").timezone, "Africa/Lagos");
  });

  it("rellena con valores por defecto lo que venga vacío o roto", () => {
    const choices = getBusinessChoices({ days: ["lunes"], payments: "efectivo" }, "Europe/Madrid");
    assert.deepEqual(choices.days, ["mon", "tue", "wed", "thu", "fri"]);
    assert.deepEqual(choices.payments, []);
    assert.equal(choices.openTime, "09:00");
    assert.equal(getBusinessChoices(null, "Europe/Madrid").country, "ES");
  });
});
