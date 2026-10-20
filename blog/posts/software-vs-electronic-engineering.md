Software engineers and electronic engineers often sit in different faculties, use different tools and even talk about "bugs" differently. Yet almost every product we use now needs both: a circuit board that senses and switches, and code that decides what to do.

So how big is the gap between the two disciplines, and is it growing or shrinking as technology moves faster?

![Technology stack showing software layers on top, electronic layers below, and a shared middle zone](images/software-electronic-stack.svg)

## Two different relationships with change

The biggest difference isn't the subject matter. It's the **cost of change**.

In software, change is cheap. On TechMove I could fix a business rule, run the xUnit tests, and have GitHub Actions confirm the build in minutes. Web teams deploy many times a day, and if something breaks, they roll back.

In electronic engineering, change is expensive. A printed circuit board revision means new manufacturing, new parts and weeks of waiting. A custom chip can take months to fabricate, and a mistake in silicon can't simply be patched. That pushes hardware engineers towards a very different mindset: heavy simulation, careful design reviews and getting things right *before* they're built.

| | Software engineering | Electronic engineering |
|---|---|---|
| Typical iteration | Minutes to days | Weeks to months |
| Cost of a mistake | Usually a redeploy | Often a new board or chip |
| Core tools | IDEs, Git, CI/CD, cloud | Simulators, CAD, oscilloscopes |
| Physical limits | Rarely visible | Power, heat, noise, timing |
| Testing focus | Automated tests | Simulation and lab measurement |

## Different ways of thinking

Software developers spend most of their time in **abstractions**. When I write an ASP.NET Core endpoint, I rarely think about the processor executing it. Layers of operating systems, runtimes and frameworks hide that detail, and that's what lets us build so quickly.

Electronic engineers work much closer to **physics**. Voltage, current, signal noise, heat and timing are everyday concerns. A design that works on paper can fail because two traces run too close together.

Neither is "harder". They train different instincts: software engineers learn to manage complexity, while electronic engineers learn to respect physical limits.

## The gap is shrinking, from both directions

### Hardware is becoming software-defined

Products are increasingly designed so that their behaviour is defined in software and can be updated after sale. Cars are the clearest example: Synopsys [estimated](https://www.synopsys.com/blogs/chip-design/600-million-lines-code-cars-2027.html) that modern vehicles contain around 300 million lines of code, a number it expects to double by 2027. Features that once needed new hardware now arrive as over-the-air updates.

### Hardware design borrows software practices

Chip and board designers now use version control, automated testing and continuous integration, ideas that came from software. Hardware description languages such as Verilog and VHDL look and behave a lot like code, and high-level synthesis can turn C-like code into circuits.

### Software engineers need more hardware awareness

On the other side, Internet of Things devices, robotics, drones and wearables all need developers who understand constraints like limited memory, battery life and real-time deadlines. Even mobile development touches this: an Android app has to be careful with battery, sensors and background work in a way that a web app usually doesn't.

## The overlap: embedded and firmware engineering

The middle of that diagram is where some of the most interesting jobs are. **Embedded and firmware engineers** write software that runs directly on microcontrollers, controlling motors, reading sensors and talking to other chips. They need to be comfortable with:

- **C and C++**, and increasingly Rust,
- **real-time operating systems** and interrupts,
- reading **datasheets and schematics**,
- using an **oscilloscope or logic analyser** to debug,
- and modern software practices like Git and automated testing.

People who can work on both sides of that line are valuable precisely because the line keeps moving.

## Where the gap still matters

Faster tech doesn't erase every difference. Physics doesn't speed up. A battery still holds only so much energy, and a radio still has to deal with interference. Supply chains for chips can take months. That means hardware timelines will always shape what software teams can promise, and good products come from both sides understanding each other's constraints early.

## What I'm taking from this

As a software developer, I don't need to become an electronic engineer. But I've come to see real value in understanding the layers beneath my code:

1. **Learn a little C.** It shows what higher-level languages are doing for you.
2. **Build something physical.** A small microcontroller project teaches more about constraints than any lecture.
3. **Respect the other side's timeline.** When hardware is involved, "we'll fix it later" may not be possible.
4. **Bring software discipline to hardware projects.** Version control, CI and tests help everywhere.

In a landscape that's moving this fast, the most useful engineers might be the ones who can stand comfortably in that overlap.
