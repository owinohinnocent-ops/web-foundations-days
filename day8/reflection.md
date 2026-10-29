# Day 8 Reflection

The most difficult concept in this course was understanding how to move from a simple working application to a system design that can handle high traffic without losing correctness. It is easy to add components such as caches, queues, replicas, and load balancers to a diagram, but the harder part is explaining which problem each component solves and what new trade-off it introduces. I worked through this by following the design sequence: clarify requirements, estimate traffic, identify the bottleneck, and add components only when the estimates justified them.

Based on the feedback and lessons from my capstone, I would improve the demonstration and explanation of failure cases. I would show not only the successful path, but also what happens when a request fails, a seat becomes unavailable, or a user retries an action. I would also make the architecture diagram easier to explain by connecting every component to a specific requirement and by stating the assumptions behind the traffic estimates.

Next, I plan to learn how to build a real backend with Node.js and Express and connect it to PostgreSQL. I want to practise implementing REST endpoints, database transactions, constraints, and safe retries in working code. This will help me connect the design decisions I can explain on paper with the engineering skills needed to implement and test them.
