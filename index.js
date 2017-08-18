require('dotenv').config()

var Crawler = require('crawler');
var Algoliasearch = require('algoliasearch');

var algoliaClient = Algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_SECRET);
var sectionIndex = algoliaClient.initIndex('sections');
var lawIndex = algoliaClient.initIndex('laws');

var fromYear = 1700;

var FINLEX_BASE = 'http://www.finlex.fi';


var lawCount = 0;
var sectionCount = 0;

var parseYearCollection = function($, year) {
	$('.doc').each(function(index, elem) {
		var url = FINLEX_BASE + $(this).find('a').attr('href');

		c.queue({
			uri: url,
			type: 'law',
			law: {
				name: $(this).find('a').text(),
				url: url,
				year: year
			}
		});
	});
};

var parseLaw = function($, law) {
	var $document = $('#document');

	var l = {
		title: $('h3:nth-child(2)').text(),
		given: $('.annettu:first-child').text(),
		url: law.url,
		name: law.name,
		year: law.year,
		objectID: law.name
	};

	lawCount++;
	//lawIndex.addObject(l);
	console.log('Laws: ' + lawCount);

	// Find all sections
	var $lastSectionHeader = null;
	$document.find('h5').each(function() {
		if (($(this).attr('id') || '').substr(0,1) === 'P') {
			if ($lastSectionHeader) {
				var title = $lastSectionHeader.text().trim();
				if (title) {
					var section = {
						title: title,
						content: $(this).prevUntil($lastSectionHeader).html(),
						url: law.url + '#' + $lastSectionHeader.attr('id').trim(),
						law: l,
						objectID: law.name + '§' + $lastSectionHeader.attr('id').trim()
					};

					sectionCount++;
					//sectionIndex.addObject(section);
					console.log('Sections: ' + sectionCount);
				}
			}

			$lastSectionHeader = $(this);
		}
	});
};

var c = new Crawler({
    maxConnections : 50,
    callback : function (error, res, done) {
        if(error) console.log('Failed. ' + res.type + ' ' + error);
        else {
            var $ = res.$;
        	if (res.options.type === 'year-collection') {
        		$('.result-pages a').each(function(index, elem) {
        			var url = FINLEX_BASE + $(this).attr('href');
        			c.queue({
        				uri: url,
        				type: 'year-collection-sub'
        			});
        		});

        		parseYearCollection($, res.options.year);
        	}
        	else if (res.options.type === 'year-collection-sub') {
				parseYearCollection($, res.options.year);
        	}
        	else if (res.options.type === 'law') {
        		parseLaw($, res.options.law);
        	}
        }

        done();
    }
});


// Fetch all years
for (var year = fromYear; year <= 2017; year++) {
	c.queue({
		uri: FINLEX_BASE + '/fi/laki/alkup/'+year+'/',
		type: 'year-collection',
		year: year
	});
}