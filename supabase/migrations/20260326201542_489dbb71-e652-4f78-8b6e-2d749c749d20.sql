UPDATE blog_posts
SET content_markdown = 'Running a custom crush facility means having two jobs at all times. The first job is making exceptional wine. The second job is managing the anxiety of the people paying you to make it. Those clients want to know where their fruit is, what the Brix is doing, when the invoice is coming, and why you have not responded to their email from Tuesday.

Most winery software is built for estate operations. One label, one team, one set of goals. When enterprise software companies try to adapt estate architecture for custom crush, they refuse to rebuild the core model. They simply bolt a permissions wall onto the database and market it as a client portal. The winemaker ends up with a clunky access control system. The client ends up confused. And you end up answering the same questions over email that the software was supposed to answer automatically.

Here is an honest look at what is actually on the market.

## The Heavyweights

**vintrace** is the enterprise behemoth. If you are running a large, complex operation with multiple bonds, granular inventory requirements, and dedicated administrative staff, vintrace can handle the depth. The billing functionality is real. The inventory tracking is thorough.

The cost is everything else. The learning curve is brutal. The interface is clunky in ways that feel like they were designed by people who have never worked a harvest shift. Getting a new cellar hand up to speed on vintrace is not a training session. It is a project. If you do not have a dedicated staff member whose job is partly just managing the software, you will fall behind. For smaller and mid-size custom crush operations, the overhead of using vintrace is genuinely punishing.

**InnoVint** has the best interface in the cellar. The usability is excellent, the mobile experience is solid, and the learning curve is reasonable. If you are running a straightforward operation and cellar management is your primary concern, InnoVint is a well-built product.

The custom crush problem is the client portal. It tends to feel like a restricted version of the winemaker''s view rather than a purpose-built client experience. Permission errors are common. The client can see some things but not others, and the logic of what is visible versus hidden is not always intuitive from the client''s side. So they email you anyway. And now you have paid for software and you are still answering the same questions.

## The Billing Black Hole

This is the exact point where custom crush facilities bleed revenue. It happens quietly, predictably, every single month.

You racked a client''s lot on a Tuesday. You added SO2. You ran a VA panel. Those are three billable line items. Did you log all three against that client''s account? Did they make it into the invoice? Or did they disappear into the general production log while you moved on to the next task?

Most winery software treats billing as a secondary feature. The workflow is: do the cellar work, log it somewhere, export a CSV at the end of the month, cross-reference it with your work orders, and manually build an invoice in QuickBooks. That process takes hours. It happens when you are already exhausted. And it misses things.

If your software is not automatically tying cellar actions to client invoices as those actions happen, you are doing free labor. Not occasionally. Every single month.

The math is brutal. A mid-size custom crush facility running fifteen client lots, billing conservatively for unbilled additions and lab panels, can recover thousands of dollars a month just by closing the gap between what happened in the cellar and what ended up on the invoice.

## The AP Compliance Nightmare

Alternating proprietorship compliance is where operators risk their licenses. Managing multiple TTB bonds under one roof requires absolute data integrity, clean lot segregation, and 5120.17 reports that accurately reflect what happened in your facility for each bond holder.

The workarounds most facilities deploy are a massive liability. Separate spreadsheets per client. Logging in and out of different software instances to pull reports for different bonds. Manually reconciling additions logs that live in three different places.

One transcription error in that process is a compliance problem. Not a paperwork headache. A license problem.

The software handling your AP workflow needs to treat bond segregation as a core architectural feature, not an afterthought bolted onto a single-tenant system.

## The Solera Custom Crush Portal

I built the Solera custom crush portal because I have worked the floor of a custom crush facility. I know the exact disconnect between the cellar and the billing office. I saw firsthand how the physical work of racking a client''s lot gets lost before it ever hits an invoice. I did not design this from a theoretical product roadmap. I built it to solve the exact frustrations I experienced on the crushpad.

The model Solera uses is different from the start. Clients do not get a restricted view of your winery''s interface. They get a dedicated, branded portal built specifically for their experience as a client. They log in and see their fermentation curves, their lab data, their milestone timeline, their invoices, and your facility''s communication log. Everything that belongs to their lot, nothing that belongs to anyone else''s.

Row-level security enforced at the database level means the isolation is not a permissions setting someone can accidentally misconfigure. It is structural. A client cannot see another client''s data. Full stop.

On the billing side, Solera ties cellar operations directly to client invoices as they happen. Every addition, every racking, every lab panel logged against a client''s lot flows automatically into their billing record. At invoice time, you are reviewing and sending, not reconstructing from memory.

The TTB and AP compliance architecture treats each client organization as a separate entity with its own additions log, its own 5120.17 export, and its own audit trail. No logging in and out of different instances. No manual reconciliation across spreadsheets.

Stop being your clients'' administrative assistant. They hired you to make their wine. Solera handles the transparency, the billing, and the compliance trail. You handle the craft.

That is the division of labor that actually makes sense.',
    updated_at = now()
WHERE id = 'cf432a7a-3e89-474c-bc44-7088fafef1e5';