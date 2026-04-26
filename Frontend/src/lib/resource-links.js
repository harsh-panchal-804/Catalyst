const CANONICAL_DOCS = {
  react: "https://react.dev/learn",
  reactjs: "https://react.dev/learn",
  "react.js": "https://react.dev/learn",
  nextjs: "https://nextjs.org/docs",
  "next.js": "https://nextjs.org/docs",
  next: "https://nextjs.org/docs",
  vue: "https://vuejs.org/guide/introduction.html",
  "vue.js": "https://vuejs.org/guide/introduction.html",
  angular: "https://angular.dev/overview",
  svelte: "https://svelte.dev/docs/svelte/overview",
  redux: "https://redux.js.org/introduction/getting-started",
  tailwind: "https://tailwindcss.com/docs",
  "tailwind css": "https://tailwindcss.com/docs",
  tailwindcss: "https://tailwindcss.com/docs",
  vite: "https://vitejs.dev/guide/",
  webpack: "https://webpack.js.org/concepts/",
  "node.js": "https://nodejs.org/docs/latest/api/",
  nodejs: "https://nodejs.org/docs/latest/api/",
  node: "https://nodejs.org/docs/latest/api/",
  express: "https://expressjs.com/en/4x/api.html",
  "express.js": "https://expressjs.com/en/4x/api.html",
  fastapi: "https://fastapi.tiangolo.com/",
  flask: "https://flask.palletsprojects.com/en/stable/",
  django: "https://docs.djangoproject.com/en/stable/",
  "spring boot": "https://spring.io/projects/spring-boot",
  spring: "https://spring.io/guides",
  rails: "https://guides.rubyonrails.org/",
  "ruby on rails": "https://guides.rubyonrails.org/",
  ".net": "https://learn.microsoft.com/en-us/dotnet/",
  dotnet: "https://learn.microsoft.com/en-us/dotnet/",
  typescript: "https://www.typescriptlang.org/docs/",
  ts: "https://www.typescriptlang.org/docs/",
  javascript: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  js: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  python: "https://docs.python.org/3/tutorial/",
  go: "https://go.dev/doc/",
  golang: "https://go.dev/doc/",
  rust: "https://doc.rust-lang.org/book/",
  java: "https://dev.java/learn/",
  kotlin: "https://kotlinlang.org/docs/home.html",
  swift: "https://www.swift.org/documentation/",
  "c++": "https://en.cppreference.com/w/cpp",
  cpp: "https://en.cppreference.com/w/cpp",
  c: "https://en.cppreference.com/w/c",
  "c#": "https://learn.microsoft.com/en-us/dotnet/csharp/",
  csharp: "https://learn.microsoft.com/en-us/dotnet/csharp/",
  ruby: "https://www.ruby-lang.org/en/documentation/",
  php: "https://www.php.net/docs.php",
  scala: "https://docs.scala-lang.org/",
  aws: "https://docs.aws.amazon.com/",
  gcp: "https://cloud.google.com/docs",
  "google cloud": "https://cloud.google.com/docs",
  azure: "https://learn.microsoft.com/en-us/azure/?product=popular",
  docker: "https://docs.docker.com/get-started/",
  kubernetes: "https://kubernetes.io/docs/home/",
  k8s: "https://kubernetes.io/docs/home/",
  terraform: "https://developer.hashicorp.com/terraform/docs",
  ansible: "https://docs.ansible.com/",
  jenkins: "https://www.jenkins.io/doc/",
  "ci/cd": "https://docs.github.com/en/actions",
  cicd: "https://docs.github.com/en/actions",
  "github actions": "https://docs.github.com/en/actions",
  postgresql: "https://www.postgresql.org/docs/current/",
  postgres: "https://www.postgresql.org/docs/current/",
  mysql: "https://dev.mysql.com/doc/",
  mongodb: "https://www.mongodb.com/docs/manual/",
  redis: "https://redis.io/docs/latest/",
  cassandra: "https://cassandra.apache.org/doc/latest/",
  elasticsearch: "https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html",
  sql: "https://www.postgresql.org/docs/current/sql.html",
  nosql: "https://www.mongodb.com/docs/manual/",
  graphql: "https://graphql.org/learn/",
  rest: "https://developer.mozilla.org/en-US/docs/Glossary/REST",
  "rest api": "https://developer.mozilla.org/en-US/docs/Glossary/REST",
  grpc: "https://grpc.io/docs/",
  kafka: "https://kafka.apache.org/documentation/",
  rabbitmq: "https://www.rabbitmq.com/documentation.html",
  websockets: "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API",
  "machine learning": "https://scikit-learn.org/stable/user_guide.html",
  ml: "https://scikit-learn.org/stable/user_guide.html",
  "deep learning": "https://pytorch.org/tutorials/",
  tensorflow: "https://www.tensorflow.org/tutorials",
  pytorch: "https://pytorch.org/tutorials/",
  "scikit-learn": "https://scikit-learn.org/stable/",
  sklearn: "https://scikit-learn.org/stable/",
  pandas: "https://pandas.pydata.org/docs/",
  numpy: "https://numpy.org/doc/stable/",
  "hugging face": "https://huggingface.co/docs",
  huggingface: "https://huggingface.co/docs",
  llm: "https://huggingface.co/learn/llm-course",
  "large language models": "https://huggingface.co/learn/llm-course",
  nlp: "https://huggingface.co/learn/nlp-course",
  "computer vision": "https://huggingface.co/learn/computer-vision-course",
  git: "https://git-scm.com/doc",
  github: "https://docs.github.com/en",
  gitlab: "https://docs.gitlab.com/",
  linux: "https://www.kernel.org/doc/html/latest/",
  bash: "https://www.gnu.org/software/bash/manual/",
  shell: "https://www.gnu.org/software/bash/manual/",
  html: "https://developer.mozilla.org/en-US/docs/Web/HTML",
  css: "https://developer.mozilla.org/en-US/docs/Web/CSS",
  "web performance": "https://web.dev/learn/performance/",
  accessibility: "https://web.dev/learn/accessibility/",
  a11y: "https://web.dev/learn/accessibility/",
  "system design": "https://github.com/donnemartin/system-design-primer",
  "data structures": "https://en.wikipedia.org/wiki/List_of_data_structures",
  algorithms: "https://en.wikipedia.org/wiki/List_of_algorithms",
  testing: "https://testing-library.com/docs/",
  jest: "https://jestjs.io/docs/getting-started",
  vitest: "https://vitest.dev/guide/",
  playwright: "https://playwright.dev/docs/intro",
  cypress: "https://docs.cypress.io/",
  security: "https://owasp.org/www-project-top-ten/",
  owasp: "https://owasp.org/www-project-top-ten/",
  airflow: "https://airflow.apache.org/docs/",
  spark: "https://spark.apache.org/docs/latest/",
  snowflake: "https://docs.snowflake.com/",
  dbt: "https://docs.getdbt.com/",
  mlops: "https://mlops.community/learn/",
  prometheus: "https://prometheus.io/docs/introduction/overview/",
  grafana: "https://grafana.com/docs/grafana/latest/"
};

const PRACTICE_LINKS = {
  javascript: "https://exercism.org/tracks/javascript",
  typescript: "https://exercism.org/tracks/typescript",
  python: "https://exercism.org/tracks/python",
  java: "https://exercism.org/tracks/java",
  go: "https://exercism.org/tracks/go",
  rust: "https://exercism.org/tracks/rust",
  "c++": "https://exercism.org/tracks/cpp",
  cpp: "https://exercism.org/tracks/cpp",
  algorithms: "https://leetcode.com/problemset/",
  "data structures": "https://leetcode.com/problemset/",
  sql: "https://leetcode.com/problemset/database/",
  "system design":
    "https://github.com/donnemartin/system-design-primer#system-design-interview-questions-with-solutions"
};

const COURSE_LINKS = {
  llm: "https://huggingface.co/learn/llm-course",
  "large language models": "https://huggingface.co/learn/llm-course",
  nlp: "https://huggingface.co/learn/nlp-course",
  "computer vision": "https://huggingface.co/learn/computer-vision-course",
  "machine learning": "https://developers.google.com/machine-learning/crash-course",
  "deep learning": "https://www.deeplearning.ai/courses/",
  python: "https://docs.python.org/3/tutorial/",
  javascript: "https://javascript.info/",
  react: "https://react.dev/learn"
};

function normalize(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ");
}

export function getSafeResourceLink(resource, skill) {
  const title = (resource?.title || "").toString();
  const typeLc = (resource?.type || "").toString().toLowerCase();
  const skillKey = normalize(skill);
  const titleKey = normalize(title);

  if (typeLc.includes("practice")) {
    if (PRACTICE_LINKS[skillKey]) {
      return { url: PRACTICE_LINKS[skillKey], source: "curated" };
    }
    if (PRACTICE_LINKS[titleKey]) {
      return { url: PRACTICE_LINKS[titleKey], source: "curated" };
    }
  }

  if (typeLc.includes("course")) {
    if (COURSE_LINKS[skillKey]) {
      return { url: COURSE_LINKS[skillKey], source: "curated" };
    }
    if (COURSE_LINKS[titleKey]) {
      return { url: COURSE_LINKS[titleKey], source: "curated" };
    }
  }

  if (CANONICAL_DOCS[skillKey]) {
    return { url: CANONICAL_DOCS[skillKey], source: "curated" };
  }
  if (CANONICAL_DOCS[titleKey]) {
    return { url: CANONICAL_DOCS[titleKey], source: "curated" };
  }

  for (const key of Object.keys(CANONICAL_DOCS)) {
    if (skillKey && skillKey.includes(key)) {
      return { url: CANONICAL_DOCS[key], source: "curated" };
    }
  }

  const queryParts = [title, skill].filter(Boolean).join(" ");
  const q = encodeURIComponent(queryParts || "documentation");
  return { url: `https://duckduckgo.com/?q=${q}`, source: "search" };
}
