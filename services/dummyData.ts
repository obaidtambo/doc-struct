
import { AnalyzedParagraph, PageDimension } from '../types';

export const DUMMY_PAGE_DIMENSIONS: PageDimension[] = [
  {
    "pageNumber": 1,
    "width": 8.2639,
    "height": 11.6806,
    "unit": "inch"
  }
];

export const DUMMY_PARAGRAPHS: AnalyzedParagraph[] = [
  {
    "id": "para-1",
    "parentId": "",
    "level": 1,
    "role": "title",
    "content": "OBAID TAMBOLI",
    "enrichment": { "personName": "OBAID TAMBOLI" },
    "boundingBox": { "x": 0.3853, "y": 0.4664, "width": 2.7225, "height": 0.2839 },
    "pageNumber": 1
  },
  {
    "id": "para-2",
    "parentId": "para-1",
    "level": 0,
    "role": "paragraph",
    "content": "@ tamboliobaid@gmail.com C +91 7066799011 in Linkedin O Web :unselected:",
    "enrichment": { "email": "tamboliobaid@gmail.com", "phone": "+91 7066799011", "linkedin": "Linkedin", "website": "Web" },
    "boundingBox": { "x": 0.3851, "y": 0.8903, "width": 4.1272, "height": 0.12869999999999993 },
    "pageNumber": 1
  },
  {
    "id": "para-3",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "EXPERIENCE",
    "enrichment": { "summary": "Details of professional work experience." },
    "boundingBox": { "x": 0.3904, "y": 1.2269, "width": 1.4347999999999999, "height": 0.1977 },
    "pageNumber": 1
  },
  {
    "id": "para-4",
    "parentId": "para-3",
    "level": 2,
    "role": "sectionHeading",
    "content": "Sr. Executive Consultant, Deloitte India, 2024, Mumbai, India",
    "enrichment": { "jobTitle": "Sr. Executive Consultant", "organizationName": "Deloitte India", "year": "2024", "location": "Mumbai, India" },
    "boundingBox": { "x": 0.3853, "y": 1.6274, "width": 1.7947000000000002, "height": 0.16220000000000012 },
    "pageNumber": 1
  },
  {
    "id": "para-5",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Built GenAl-based compliance checker (Azure Al + LangChain) and automated LLM-driven reporting, reducing manual effort and turnaround time by 50%.",
    "enrichment": { "achievement": "Built GenAI-based compliance checker and automated LLM-driven reporting, reducing manual effort and turnaround time by 50%." },
    "boundingBox": { "x": 0.3904, "y": 2.2661, "width": 4.1623, "height": 0.47660000000000036 },
    "pageNumber": 1
  },
  {
    "id": "para-6",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Engineered scalable ETL pipelines for ECL computation (IFRS 9 PD), improving data throughput by 40% across Indian and global banks.",
    "enrichment": { "achievement": "Engineered scalable ETL pipelines for ECL computation (IFRS 9 PD), improving data throughput by 40% across Indian and global banks." },
    "boundingBox": { "x": 0.3902, "y": 2.8035, "width": 4.2387999999999995, "height": 0.3245999999999998 },
    "pageNumber": 1
  },
  {
    "id": "para-7",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Applied ML for IRB model stress testing, enhancing predictive accuracy and regulatory compliance.",
    "enrichment": { "achievement": "Applied ML for IRB model stress testing, enhancing predictive accuracy and regulatory compliance." },
    "boundingBox": { "x": 0.3853, "y": 3.1838, "width": 3.8834999999999997, "height": 0.3243999999999998 },
    "pageNumber": 1
  },
  {
    "id": "para-8",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Leveraged RAG and GenAl to extract actionable insights from unstructured data; drove AI adoption across credit risk workflows, increasing process efficiency.",
    "enrichment": { "achievement": "Leveraged RAG and GenAI to extract actionable insights from unstructured data; drove AI adoption across credit risk workflows, increasing process efficiency." },
    "boundingBox": { "x": 0.3802, "y": 3.5538, "width": 4.152299999999999, "height": 0.4866999999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-9",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Provided GenAl risk and ethics consultancy to senior stakeholders, influencing enterprise-level AI governance.",
    "enrichment": { "achievement": "Provided GenAI risk and ethics consultancy to senior stakeholders, influencing enterprise-level AI governance." },
    "boundingBox": { "x": 0.3849, "y": 4.0912, "width": 4.1883, "height": 0.31930000000000014 },
    "pageNumber": 1
  },
  {
    "id": "para-10",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Conducted statistical validation of credit risk models, ensuring robustness and alignment with regulatory standards.",
    "enrichment": { "achievement": "Conducted statistical validation of credit risk models, ensuring robustness and alignment with regulatory standards." },
    "boundingBox": { "x": 0.39, "y": 4.4613, "width": 3.8992999999999998, "height": 0.3244000000000007 },
    "pageNumber": 1
  },
  {
    "id": "para-11",
    "parentId": "para-4",
    "level": 0,
    "role": "paragraph",
    "content": "· Built end-to-end ML-driven stress testing for a global bank; quantified adverse financial and qualitative impacts for C-suite decision-making.",
    "enrichment": { "achievement": "Built end-to-end ML-driven stress testing for a global bank; quantified adverse financial and qualitative impacts for C-suite decision-making." },
    "boundingBox": { "x": 0.3849, "y": 4.8416, "width": 4.3455, "height": 0.3192000000000004 },
    "pageNumber": 1
  },
  {
    "id": "para-12",
    "parentId": "para-3",
    "level": 2,
    "role": "sectionHeading",
    "content": "Data Science Intern, Respirer Living Sciences Pvt. Ltd 2023, Pune, India",
    "enrichment": { "jobTitle": "Data Science Intern", "organizationName": "Respirer Living Sciences Pvt. Ltd", "year": "2023", "location": "Pune, India" },
    "boundingBox": { "x": 0.3802, "y": 5.3739, "width": 1.4348, "height": 0.16220000000000034 },
    "pageNumber": 1
  },
  {
    "id": "para-13",
    "parentId": "para-12",
    "level": 0,
    "role": "paragraph",
    "content": "· Employed advanced Machine Learning algorithms for resilient real-time time series models.",
    "enrichment": { "achievement": "Employed advanced Machine Learning algorithms for resilient real-time time series models." },
    "boundingBox": { "x": 0.3853, "y": 6.0177, "width": 3.8734, "height": 0.32450000000000045 },
    "pageNumber": 1
  },
  {
    "id": "para-14",
    "parentId": "para-12",
    "level": 0,
    "role": "paragraph",
    "content": "· Implemented Explainable Al, improving transparency and reliability.",
    "enrichment": { "achievement": "Implemented Explainable AI, improving transparency and reliability." },
    "boundingBox": { "x": 0.3904, "y": 6.3929, "width": 4.208, "height": 0.1520999999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-15",
    "parentId": "para-12",
    "level": 0,
    "role": "paragraph",
    "content": "· Conducted rigorous statistical testing and validation of ML models.",
    "enrichment": { "achievement": "Conducted rigorous statistical testing and validation of ML models." },
    "boundingBox": { "x": 0.3851, "y": 6.5957, "width": 4.1881, "height": 0.1570999999999998 },
    "pageNumber": 1
  },
  {
    "id": "para-16",
    "parentId": "para-12",
    "level": 0,
    "role": "paragraph",
    "content": ". Deployed and monitored ML models for real-time calibration",
    "enrichment": { "achievement": "Deployed and monitored ML models for real-time calibration." },
    "boundingBox": { "x": 0.3851, "y": 6.8086, "width": 3.8230999999999997, "height": 0.1570999999999998 },
    "pageNumber": 1
  },
  {
    "id": "para-17",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "TECHNICAL SKILLS",
    "enrichment": { "summary": "List of technical skills and proficiencies." },
    "boundingBox": { "x": 0.3802, "y": 7.2344, "width": 2.1446, "height": 0.21799999999999997 },
    "pageNumber": 1
  },
  {
    "id": "para-18",
    "parentId": "para-17",
    "level": 0,
    "role": "paragraph",
    "content": "· Programming Languages : Python (proficient), Java, SQL",
    "enrichment": { "skillCategory": "Programming Languages", "skills": "Python (proficient), Java, SQL" },
    "boundingBox": { "x": 0.3851, "y": 7.6248, "width": 3.1995, "height": 0.14700000000000024 },
    "pageNumber": 1
  },
  {
    "id": "para-19",
    "parentId": "para-17",
    "level": 0,
    "role": "paragraph",
    "content": "· Tools/Libraries: HuggingFace, Pytorch, LangChain, nltk, Pandas, Numpy, Scikit-learn, matplotlib, PySpark | (proficient)",
    "enrichment": { "skillCategory": "Tools/Libraries", "skills": "HuggingFace, Pytorch, LangChain, nltk, Pandas, Numpy, Scikit-learn, matplotlib, PySpark (proficient)" },
    "boundingBox": { "x": 0.3849, "y": 7.8124, "width": 4.0616, "height": 0.30100000000000016 },
    "pageNumber": 1
  },
  {
    "id": "para-20",
    "parentId": "para-17",
    "level": 0,
    "role": "paragraph",
    "content": "· Cloud Services : Azure-ML (proficient), Firebase, Amazon AWS",
    "enrichment": { "skillCategory": "Cloud Services", "skills": "Azure-ML (proficient), Firebase, Amazon AWS" },
    "boundingBox": { "x": 0.3904, "y": 8.1571, "width": 3.5438, "height": 0.14199999999999946 },
    "pageNumber": 1
  },
  {
    "id": "para-21",
    "parentId": "para-17",
    "level": 0,
    "role": "paragraph",
    "content": "· Softwares : Perplexity, OpenAl, Matlab, MySQL, PowerBI",
    "enrichment": { "skillCategory": "Software", "skills": "Perplexity, OpenAI, Matlab, MySQL, PowerBI" },
    "boundingBox": { "x": 0.3853, "y": 8.3447, "width": 3.265, "height": 0.14700000000000024 },
    "pageNumber": 1
  },
  {
    "id": "para-22",
    "parentId": "para-17",
    "level": 0,
    "role": "paragraph",
    "content": ". Concepts : ECL, Model Risk Management, Stress Testing, IFRS9, Basel III",
    "enrichment": { "skillCategory": "Concepts", "skills": "ECL, Model Risk Management, Stress Testing, IFRS9, Basel III" },
    "boundingBox": { "x": 0.3853, "y": 8.5374, "width": 4.0762, "height": 0.14700000000000024 },
    "pageNumber": 1
  },
  {
    "id": "para-23",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "PROJECTS",
    "enrichment": { "summary": "Details of personal and academic projects." },
    "boundingBox": { "x": 0.3904, "y": 8.8314, "width": 1.1507999999999998, "height": 0.21799999999999997 },
    "pageNumber": 1
  },
  {
    "id": "para-24",
    "parentId": "para-23",
    "level": 2,
    "role": "sectionHeading",
    "content": "AI Text Detection (January 2024 - February 2024)",
    "enrichment": { "projectTitle": "AI Text Detection", "projectDates": "January 2024 - February 2024" },
    "boundingBox": { "x": 0.3802, "y": 9.2572, "width": 1.0951, "height": 0.1369000000000007 },
    "pageNumber": 1
  },
  {
    "id": "para-25",
    "parentId": "para-24",
    "level": 0,
    "role": "paragraph",
    "content": "· Developing Novel Robust Domain-Adaptive Self-Supervised Al Text Detection Model for Microsoft",
    "enrichment": { "projectDescription": "Developing Novel Robust Domain-Adaptive Self-Supervised AI Text Detection Model for Microsoft." },
    "boundingBox": { "x": 0.3853, "y": 9.678, "width": 4.2435, "height": 0.3092999999999986 },
    "pageNumber": 1
  },
  {
    "id": "para-26",
    "parentId": "para-23",
    "level": 2,
    "role": "sectionHeading",
    "content": "Mufti Chatbot (November 2023 - Ongoing)",
    "enrichment": { "projectTitle": "Mufti Chatbot", "projectDates": "November 2023 - Ongoing" },
    "boundingBox": { "x": 0.3802, "y": 10.2408, "width": 0.8974000000000001, "height": 0.13679999999999914 },
    "pageNumber": 1
  },
  {
    "id": "para-27",
    "parentId": "para-26",
    "level": 0,
    "role": "paragraph",
    "content": "· Fine-tuned Llama2-7B model on Islamic QA data.",
    "enrichment": { "projectDescription": "Fine-tuned Llama2-7B model on Islamic QA data." },
    "boundingBox": { "x": 0.3904, "y": 10.6666, "width": 3.1229999999999998, "height": 0.152099999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-28",
    "parentId": "para-26",
    "level": 0,
    "role": "paragraph",
    "content": "· Created a RAG on the fine-tuned model using LangChain.",
    "enrichment": { "projectDescription": "Created a RAG on the fine-tuned model using LangChain." },
    "boundingBox": { "x": 0.3853, "y": 10.8694, "width": 3.625, "height": 0.15719999999999956 },
    "pageNumber": 1
  },
  {
    "id": "para-29",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "EDUCATION",
    "enrichment": { "summary": "Educational background and qualifications." },
    "boundingBox": { "x": 5.1908, "y": 1.2117, "width": 1.3956999999999997, "height": 0.2129000000000001 },
    "pageNumber": 1
  },
  {
    "id": "para-30",
    "parentId": "para-29",
    "level": 0,
    "role": "paragraph",
    "content": "Indian Institute of Science Education and Research, Bhopal, Madhya Pradesh. Data Science Engineering (Major) EECS (Minor) CGPA - 8.23/10",
    "enrichment": { "institution": "Indian Institute of Science Education and Research, Bhopal", "degree": "Data Science Engineering (Major) EECS (Minor)", "cgpa": "8.23/10" },
    "boundingBox": { "x": 5.1662, "y": 1.6476, "width": 2.6820000000000004, "height": 0.3651000000000002 },
    "pageNumber": 1
  },
  {
    "id": "para-31",
    "parentId": "para-29",
    "level": 0,
    "role": "paragraph",
    "content": "Higher Secondary Poona College, Pune, Maharashtra. Percentage - 84.00%",
    "enrichment": { "institution": "Poona College, Pune, Maharashtra", "degree": "Higher Secondary", "percentage": "84.00%" },
    "boundingBox": { "x": 5.1763, "y": 2.8035, "width": 1.3182, "height": 0.3700999999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-32",
    "parentId": "para-29",
    "level": 0,
    "role": "paragraph",
    "content": "Secondary Bhishop's CO-ED School, Undri, Pune, Maharashtra. Percentage - 91.40%",
    "enrichment": { "institution": "Bhishop's CO-ED School, Undri, Pune, Maharashtra", "degree": "Secondary", "percentage": "91.40%" },
    "boundingBox": { "x": 5.1763, "y": 3.8175, "width": 1.9468999999999994, "height": 0.3700999999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-33",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "ACHIEVEMENTS",
    "enrichment": { "summary": "Notable achievements and recognitions." },
    "boundingBox": { "x": 5.1763, "y": 4.8872, "width": 1.8606999999999996, "height": 0.2129000000000003 },
    "pageNumber": 1
  },
  {
    "id": "para-34",
    "parentId": "para-33",
    "level": 0,
    "role": "paragraph",
    "content": "GATE 2024 Qualified GATE with rank 2635 in Data Science and Artificial Intelligence (DA)",
    "enrichment": { "achievement": "Qualified GATE 2024 with rank 2635 in Data Science and Artificial Intelligence (DA)." },
    "boundingBox": { "x": 5.1763, "y": 5.2674, "width": 2.7022999999999993, "height": 0.6488999999999994 },
    "pageNumber": 1
  },
  {
    "id": "para-35",
    "parentId": "para-33",
    "level": 0,
    "role": "paragraph",
    "content": "Publication 2024 Research Paper on AI Text Detection in IJCAI",
    "enrichment": { "achievement": "Published Research Paper on AI Text Detection in IJCAI (2024)." },
    "boundingBox": { "x": 5.1733, "y": 5.9697, "width": 2.7134, "height": 0.4872000000000005 },
    "pageNumber": 1
  },
  {
    "id": "para-36",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "COURSES AND CERTIFICATION",
    "enrichment": { "summary": "List of completed courses and certifications." },
    "boundingBox": { "x": 5.1814, "y": 6.6818, "width": 1.7694, "height": 0.40559999999999974 },
    "pageNumber": 1
  },
  {
    "id": "para-37",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Deep Learning | Udemy",
    "enrichment": { "courseTitle": "Deep Learning", "issuingAuthority": "Udemy" },
    "boundingBox": { "x": 5.2625, "y": 7.3003, "width": 1.4348, "height": 0.1520999999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-38",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Data Science | Udemy",
    "enrichment": { "courseTitle": "Data Science", "issuingAuthority": "Udemy" },
    "boundingBox": { "x": 5.2569, "y": 7.5386, "width": 1.3497000000000003, "height": 0.15720000000000045 },
    "pageNumber": 1
  },
  {
    "id": "para-39",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Machine Learning | Coursera",
    "enrichment": { "courseTitle": "Machine Learning", "issuingAuthority": "Coursera" },
    "boundingBox": { "x": 5.257, "y": 7.787, "width": 1.7449000000000003, "height": 0.15720000000000045 },
    "pageNumber": 1
  },
  {
    "id": "para-40",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Generative AI | Coursera",
    "enrichment": { "courseTitle": "Generative AI", "issuingAuthority": "Coursera" },
    "boundingBox": { "x": 5.2575, "y": 8.0304, "width": 1.4955999999999996, "height": 0.16220000000000034 },
    "pageNumber": 1
  },
  {
    "id": "para-41",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Gen AI Ethics and Responsibility | Udemy",
    "enrichment": { "courseTitle": "Gen AI Ethics and Responsibility", "issuingAuthority": "Udemy" },
    "boundingBox": { "x": 5.2568, "y": 8.2788, "width": 2.5007, "height": 0.16220000000000034 },
    "pageNumber": 1
  },
  {
    "id": "para-42",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Credit Risk In Python | Coursera",
    "enrichment": { "courseTitle": "Credit Risk In Python", "issuingAuthority": "Coursera" },
    "boundingBox": { "x": 5.252, "y": 8.5272, "width": 1.9573999999999998, "height": 0.15719999999999956 },
    "pageNumber": 1
  },
  {
    "id": "para-43",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Artificial Intelligence | IISERB",
    "enrichment": { "courseTitle": "Artificial Intelligence", "issuingAuthority": "IISERB" },
    "boundingBox": { "x": 5.2422, "y": 8.7756, "width": 1.7795999999999994, "height": 0.152099999999999 },
    "pageNumber": 1
  },
  {
    "id": "para-44",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "LLM Fundamentals | IBM",
    "enrichment": { "courseTitle": "LLM Fundamentals", "issuingAuthority": "IBM" },
    "boundingBox": { "x": 5.2473, "y": 9.024, "width": 1.5462999999999996, "height": 0.1471 },
    "pageNumber": 1
  },
  {
    "id": "para-45",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Computer Vision | IISERB",
    "enrichment": { "courseTitle": "Computer Vision", "issuingAuthority": "IISERB" },
    "boundingBox": { "x": 5.2524, "y": 9.2725, "width": 1.5463000000000005, "height": 0.14699999999999847 },
    "pageNumber": 1
  },
  {
    "id": "para-46",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Advanced NLP | Udemy",
    "enrichment": { "courseTitle": "Advanced NLP", "issuingAuthority": "Udemy" },
    "boundingBox": { "x": 5.2519, "y": 9.5158, "width": 1.4561000000000002, "height": 0.15719999999999956 },
    "pageNumber": 1
  },
  {
    "id": "para-47",
    "parentId": "para-36",
    "level": 0,
    "role": "paragraph",
    "content": "Quantum Computer Science | IISERB",
    "enrichment": { "courseTitle": "Quantum Computer Science", "issuingAuthority": "IISERB" },
    "boundingBox": { "x": 5.2575, "y": 9.7693, "width": 2.2408, "height": 0.1570999999999998 },
    "pageNumber": 1
  },
  {
    "id": "para-48",
    "parentId": "",
    "level": 1,
    "role": "sectionHeading",
    "content": "SOFT SKILLS",
    "enrichment": { "summary": "List of soft skills." },
    "boundingBox": { "x": 5.1763, "y": 10.114, "width": 1.4296999999999995, "height": 0.2129999999999992 },
    "pageNumber": 1
  },
  {
    "id": "para-49",
    "parentId": "para-48",
    "level": 0,
    "role": "paragraph",
    "content": "Hard-working",
    "enrichment": { "softSkill": "Hard-working" },
    "boundingBox": { "x": 5.2017, "y": 10.4943, "width": 0.9379, "height": 0.23819999999999908 },
    "pageNumber": 1
  },
  {
    "id": "para-50",
    "parentId": "para-48",
    "level": 0,
    "role": "paragraph",
    "content": "Eye for detail",
    "enrichment": { "softSkill": "Eye for detail" },
    "boundingBox": { "x": 6.1345, "y": 10.4943, "width": 1.1965000000000003, "height": 0.24329999999999963 },
    "pageNumber": 1
  },
  {
    "id": "para-51",
    "parentId": "para-48",
    "level": 0,
    "role": "paragraph",
    "content": "Team Work",
    "enrichment": { "softSkill": "Team Work" },
    "boundingBox": { "x": 5.2017, "y": 10.7325, "width": 0.9328000000000003, "height": 0.23830000000000062 },
    "pageNumber": 1
  },
  {
    "id": "para-52",
    "parentId": "para-48",
    "level": 0,
    "role": "paragraph",
    "content": "Learning Potential",
    "enrichment": { "softSkill": "Learning Potential" },
    "boundingBox": { "x": 6.1295, "y": 10.7325, "width": 1.2015000000000002, "height": 0.2433999999999994 },
    "pageNumber": 1
  }
];
