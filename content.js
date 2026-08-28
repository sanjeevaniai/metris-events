/* Copy that appears on more than one page. Shared through a plain script tag,
   so the bios exist once rather than three times over. No bundler. */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.METRIS_CONTENT = factory();
})(typeof self !== "undefined" ? self : this, function () {

  var speakerNote = "My colleague Karlos and I lead this session together. He brings twenty-five years of experience inside large organizations, seeing where strategy succeeds, or breaks down, in operations. I build the measurement that shows whether it’s working. Together, we cover both sides of the question: what should you do, and how do you know it worked?";

  /* Two bios each. shortBio is what the 340px panel shows, since the full one
     will not fit at that width without an internal scroll. bio is the full
     version, kept for anywhere with room for it. */
  var speakers = [
    {
      name: "Suneeta Modekurty",
      role: "Founder and CEO",
      org: "METRIS",
      photo: "suneeta-modekurty.jpg",
      linkedin: "https://www.linkedin.com/in/smodekurty/",
      shortBio: "Suneeta builds the measurement systems behind METRIS, after ten years as a data scientist and bioinformatician inside healthcare, insurance and life sciences companies. She teaches this material as an O\u2019Reilly live trainer.",
      bio: [
        "Suneeta builds the measurement systems behind METRIS, after ten years as a data scientist and bioinformatician inside healthcare, insurance, title and life sciences companies, where the hard part was rarely the model and almost always whether anyone could tell if it was working.",
        "She teaches this material as an O\u2019Reilly live trainer, wrote The AI-Human Synergy in 2024, and holds ISO/IEC 27701 and ISO/IEC 42001 Lead Auditor certification.",
        "She holds an MS in Bioinformatics from Indiana University, first-authored research presented at ASCO 2024, and reviews manuscripts for PLOS ONE and Frontiers. Before any of it she taught for seventeen years in India."
      ]
    },
    {
      name: "Karlos Bledsoe Sr.",
      role: "Certified Business and Executive Coach",
      org: "FocalPoint Coaching",
      photo: "karlos-bledsoe.jpg",
      linkedin: "https://www.linkedin.com/in/karlos-bledsoe/",
      shortBio: "Karlos spent more than 25 years at Anheuser-Busch, Edward Jones and BJC, finishing as Director of Strategy and Operations. He now coaches executives on strategy execution and operational performance.",
      bio: [
        "Karlos spent more than 25 years at Anheuser-Busch, Edward Jones and BJC, finishing as Director of Strategy and Operations, and now coaches executives on strategy execution and operational performance.",
        "He has led strategic planning, data warehousing and analytics, project management and lean six sigma across IT, manufacturing and internal consulting.",
        "He is a founding member of the St. Louis chapter of the Society for Information Management and founded the St. Louis Gateway to Innovation IT conference."
      ]
    }
  ];

  var footer = {
    org: "METRIS by SANJEEVANI AI LLC \u00b7 St. Louis, Missouri",
    privacyUrl: "https://www.sanjeevaniai.com/privacy",
    termsUrl: "https://www.sanjeevaniai.com/terms",
    linkedin: "https://www.linkedin.com/company/sanjeevaniai/",
    replyTo: "hello@sanjeevaniai.com"
  };

  return { speakerNote: speakerNote, speakers: speakers, footer: footer };
});
