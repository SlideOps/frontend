/*
 * Holding the browser's types to the ones the server actually sends.
 *
 * `docker-generated.ts` is written by a generator that walks the Go structs, so
 * it is the wire, exactly: every list is nullable because Go marshals a nil
 * slice as null, and every `omitempty` field is optional because that is what
 * omitempty does. That file is true but tiring to read, and it says nothing
 * about the promises this client makes on top of it -- that a list is always a
 * list once it has been through a normaliser, or that a state string is one of
 * six known values.
 *
 * So the app's types are declared as narrowings of the generated ones rather
 * than beside them. The narrowing is the only place a hand-written shape is
 * allowed to disagree with the wire, and it has to say which fields it is
 * disagreeing about, which is the part that keeps working after everyone has
 * forgotten this file exists.
 */

/**
 * A generated wire type with some of its fields restated.
 *
 * `Patch` may only mention fields `Base` actually has. A key that is not on
 * `Base` resolves to `never` in the constraint, so nothing can be assigned to
 * it and the narrowing stops compiling. That is the whole point: when a field
 * is renamed or dropped in Go, regenerating turns the next build red here,
 * rather than turning a screen blank in front of an Operator months later.
 *
 * It does not check that the narrowed type is a subtype of the wire type, and
 * deliberately so. A normaliser that turns `string[] | null` into `string[]`
 * is narrowing; one that turns `number` into a formatted `string` is a
 * different value under the same name, and a type system cannot tell those
 * apart from the declaration alone. What it can tell -- and what went wrong
 * every previous time -- is whether the field is still there at all.
 */
export type Narrowed<
  Base,
  Patch extends { [K in keyof Patch]: K extends keyof Base ? unknown : never },
> = Omit<Base, keyof Patch> & Patch;
