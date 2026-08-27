/**
 * Central site content: about, certifications, skills, projects.
 * Extracted into one module so pages render from a single source of truth.
 */

export const SITE = {
  name: 'Feizal Said',
  role: 'Cybersecurity & Cloud Security Engineer',
  location: 'Nairobi, Kenya',
  email: 'feizalsaid9@gmail.com',
  url: 'https://feizalsaid.github.io',
  socials: {
    github: 'https://github.com/feizalsaid',
    linkedin: 'https://www.linkedin.com/in/feizalsaid',
    medium: 'https://medium.com/@feizalsaid9',
    hackthebox: 'https://app.hackthebox.com/users/feizalsaid',
    tryhackme: 'https://tryhackme.com/p/feizalsaid',
  },
};

export interface AboutParagraph {
  lead?: boolean;
  text: string;
}

export const ABOUT: {
  title: string;
  paragraphs: AboutParagraph[];
  tags: string[];
  profile?: { src: string; alt: string; width: number; height: number };
} = {
  title:
    'Cybersecurity engineer specializing in threat detection, SIEM operations, penetration testing, and cloud infrastructure security.',
  paragraphs: [
    {
      lead: true,
      text: 'Cybersecurity engineer with hands-on experience across offensive and defensive security. I operate a production-grade Wazuh SIEM homelab, author MITRE ATT&CK-mapped detection content, and have completed 72+ machines across Hack The Box, TryHackMe, and VulnHub with documented attack chains.',
    },
    {
      text: 'On the offensive side I cover privilege escalation, web exploitation, Active Directory attacks, and post-exploitation techniques. On the defensive side I work with Splunk and Wazuh for log analysis, alert triage, and SIEM operations, and use OpenSCAP for CIS compliance automation.',
    },
    {
      text: 'I build and tear down complex lab environments with Vagrant, QEMU, VMware, and Hyper-V, and automate infrastructure with Ansible, Terraform, and Docker. Currently pursuing the HTB CPTS certification while building foundations in cloud security (AWS and Azure).',
    },
  ],
  tags: [
    'CompTIA Security+ Certified',
    'HTB CPTS In Progress',
    '72+ Labs · HTB/THM/VulnHub',
    'Wazuh · Splunk · SIEM',
    'MITRE ATT&CK',
    'Ansible · Terraform · Docker',
    'Vagrant · QEMU · VMware',
    'AWS · Azure · Cloud Security',
  ],
  profile: { src: '/images/profile.avif', alt: 'Feizal Said', width: 480, height: 640 },
};

export interface Certification {
  name: string;
  date: string;
  status?: 'earned' | 'in-progress';
  description: string;
  icon: string;
}

export const CERTIFICATIONS: Certification[] = [
  {
    name: 'CompTIA Security+',
    date: 'November 2025',
    status: 'earned',
    icon: 'fa-solid fa-shield',
    description:
      'The baseline. Certified in core cybersecurity principles, network security design, cryptography, threat analysis, and risk management.',
  },
  {
    name: 'HTB CJCA Coursework',
    date: '2024',
    status: 'earned',
    icon: 'fa-solid fa-graduation-cap',
    description:
      'Completed coursework covering security fundamentals, vulnerability assessment, and defensive techniques.',
  },
  {
    name: 'HTB Certified Penetration Tester (CPTS)',
    date: 'In Progress · Expected Q1 2026',
    status: 'in-progress',
    icon: 'fa-solid fa-bug',
    description:
      'Practical exploitation certification covering Active Directory attacks, web application testing, and privilege escalation chains.',
  },
];

export interface SkillGroup {
  group: string;
  skills: string[];
}

export const SKILLS: SkillGroup[] = [
  {
    group: 'Security Operations',
    skills: [
      'Wazuh SIEM',
      'Splunk SPL',
      'Custom Detection Rules',
      'MITRE ATT&CK',
      'Log Analysis',
      'Alert Triage',
      'CIS Benchmarks',
      'OpenSCAP',
    ],
  },
  {
    group: 'Cloud & Infrastructure',
    skills: ['AWS (IAM, S3, VPC, CloudTrail)', 'Azure (AD/Entra ID, NSGs)', 'Terraform', 'Ansible', 'Docker', 'Vagrant', 'VirtualBox', 'VMware'],
  },
  {
    group: 'Offensive Security',
    skills: ['Metasploit', 'Burp Suite', 'Nmap', 'Buffer Overflow', 'SUID Exploitation', 'Active Directory', 'Kerberos', 'LDAP', 'BloodHound'],
  },
  {
    group: 'Scripting & Systems',
    skills: ['Python', 'Bash', 'PowerShell', 'JavaScript', 'Linux (Ubuntu/Arch)', 'Windows', 'TCP/IP', 'Git'],
  },
];

export interface Project {
  name: string;
  description: string;
  tags: string[];
  href: string;
  external?: boolean;
  icon?: string;
}

export const PROJECTS: Project[] = [
  {
    name: 'Multi-Node Wazuh SIEM Stack',
    description:
      '3-node SIEM infrastructure (Ubuntu Manager + Arch + Windows 11 agents) with 15+ custom detection rules mapped to MITRE ATT&CK, centralized rule management, and automated CIS compliance via OpenSCAP + Ansible. Zero high-severity vulnerabilities.',
    tags: ['Wazuh', 'OpenSCAP', 'Ansible', 'CIS', 'MITRE ATT&CK'],
    href: '/writeups/wazuh-siemsetup/',
    icon: 'fa-solid fa-shield-halved',
  },
  {
    name: 'Splunk Lateral Movement Detection',
    description:
      'Production-grade SPL detection content for RDP lateral movement: 5+ correlation searches, peer-group anomaly detection (95%+ accuracy), brute-force identification, and false positive tuning (35% to <5%) with risk-based alerting.',
    tags: ['Splunk', 'SPL', 'Detection Engineering', 'MITRE ATT&CK'],
    href: '/writeups/splunk-rdp-lateral-02/',
    icon: 'fa-solid fa-magnifying-glass-chart',
  },
  {
    name: 'Vagrant Lab Automation & IaC',
    description:
      'Reproducible VM provisioning with Vagrant + VirtualBox infrastructure-as-code, reusable Vagrantfiles for lab images, and Ansible automation reducing deployment from 4 hours to 10 minutes. Terraform for cloud infrastructure.',
    tags: ['Vagrant', 'VirtualBox', 'Terraform', 'Ansible', 'Docker'],
    href: '/writeups/vagrant-setup/',
    icon: 'fa-solid fa-boxes-stacked',
  },
  {
    name: 'Offensive Security Writeup Collection',
    description:
      '15+ published walkthroughs across HTB, THM, VulnHub, OverTheWire, and UnderTheWire covering buffer overflow, SUID abuse, cron hijacking, AD attacks, SMB enumeration, and cryptography — full attack chains with defensive recommendations.',
    tags: ['CTF', 'Buffer Overflow', 'AD', 'Writeups'],
    href: '/writeups/vulnhub-writeups-hub/',
    icon: 'fa-solid fa-bug',
  },
  {
    name: 'Security Portfolio Site',
    description:
      'This site — a server-rendered Astro portfolio with markdown writeup collections, sitemap, and dark/light theme. Built for SEO and crawlability, deployed to GitHub Pages.',
    tags: ['Astro', 'TypeScript', 'Tailwind', 'GitHub Pages'],
    href: 'https://github.com/feizalsaid/feizalsaid.github.io',
    external: true,
    icon: 'fa-solid fa-code',
  },
];
