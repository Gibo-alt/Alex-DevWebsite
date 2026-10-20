In 2001, most software shipped on a CD. You bought it in a box, installed it, and waited a year or two for the next version. Today the apps on my phone update themselves overnight, my projects deploy from a `git push`, and an AI assistant can draft a function before I've finished describing it.

A quarter of the way into the century, it's worth looking at how we got here, because each shift changed not just *what* software does but *how* developers work.

![Timeline of software milestones from 2001 to 2026](images/software-timeline.svg)

## 1. The web becomes the platform (2000s)

After the dot-com crash, the web didn't disappear. It matured. Browsers became capable enough to run real applications, and software moved from something you installed to something you *visited*.

That changed the economics completely. A bug fix no longer needed a new disc; you deployed it to the server and every user had it instantly. It also pushed teams to work in shorter cycles. The **Agile Manifesto** (2001) captured a mood that was already spreading: build in small increments, talk to your users, respond to change.

## 2. Version control goes distributed (2005)

**Git** arrived in 2005, and later GitHub made it social. That sounds like a tooling detail, but it changed collaboration. Branching became cheap, open source exploded, and "show me your GitHub" became part of how developers get hired.

On REGGY this year, our six-person team ran the entire project through feature branches and pull requests. That workflow is so normal now that it's easy to forget it's only been mainstream for about fifteen years.

## 3. Mobile puts a computer in every pocket (2007 onward)

The iPhone (2007) and the App Store (2008), followed quickly by Android, created a completely new kind of software: always with you, aware of location, camera and sensors, and expected to be fast and beautiful.

Mobile also taught the industry a hard lesson in **platform thinking**. One product might now need an iOS app, an Android app and a website, all talking to the same backend. That's exactly why so much modern work centres on well-designed APIs.

## 4. The cloud removes the server room (2006 onward)

When Amazon launched EC2 in 2006, renting computing power by the hour became possible. Microsoft Azure and Google Cloud followed. Suddenly a student could deploy to the same kind of infrastructure as a large company, paying only for what they used.

Containers (**Docker**, 2013) and orchestration (**Kubernetes**, 2014) then made applications portable: package it once, run it anywhere. Combined with CI/CD pipelines, this gave rise to **DevOps**, the idea that the people who build software should also own how it's deployed and run.

## 5. Data and machine learning (2010s)

With cheap storage and cloud compute, companies started collecting enormous amounts of data, and machine learning moved from research labs into products: recommendations, fraud detection, translation, photo search. Software stopped being only rules a developer wrote by hand; some behaviour was now *learned* from data.

## 6. Software is everywhere, even in your car

Software is no longer just in computers. Cars are a striking example: Synopsys [estimated in late 2025](https://www.synopsys.com/blogs/chip-design/600-million-lines-code-cars-2027.html) that a modern vehicle contains around 300 million lines of code, and predicted that figure could double by 2027. Banking, healthcare, farming and energy all run on code now.

## 7. The AI-assisted era (2020s)

The release of ChatGPT in late 2022 was the moment most people noticed, but the bigger story for developers is what came after: AI that writes, reviews, tests and refactors code alongside us. I've written about this separately in [how AI is being used in tech companies](post.html?slug=ai-in-tech-companies).

## What stayed the same

For all of that change, the fundamentals have held up remarkably well:

- **Clear requirements still matter.** The best tooling can't save a feature nobody needed.
- **Good structure still matters.** Separating concerns into layers, as I did with middleware, controllers and services in HustleHub+, makes systems easier to secure and change.
- **Testing still matters.** Code is cheaper to write than ever, which makes checking it more important, not less.
- **Communication still matters.** Most of the hardest moments on a team project are about people and expectations, not syntax.

## What it means for new developers

I'm entering the industry at an unusual moment. The tools are more powerful than they've ever been, and the ground keeps moving. My takeaway from looking back is that the developers who thrived through each wave weren't the ones who knew one specific tool. They understood the fundamentals well enough to pick up whatever came next.

That's the kind of developer I'm working to become.
