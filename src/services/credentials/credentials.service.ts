import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class CredentialsService {
  constructor(private readonly httpService: HttpService) {}

  //schema Create
  async schemaCreate(postrequest) {
    const url = `${process.env.SCHEMA_URL}/credential-schema`;
    var data = JSON.stringify(postrequest);
    var config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    let response_list = null;
    try {
      const observable = this.httpService.post(url, data, config);

      const promise = observable.toPromise();

      const response = await promise;
      response_list = response.data;
      //console.log(response.data);
    } catch (e) {
      console.log('schema error', e.message);
      response_list = { error: e };
    }
    return response_list;
  }

  //schema list
  async schemaList(taglist) {
    const url = `${process.env.SCHEMA_URL}/credential-schema?tags=${taglist}`;
    let response_list = null;
    try {
      const observable = this.httpService.get(url);

      const promise = observable.toPromise();

      const response = await promise;
      response_list = response.data;
      //console.log(response.data);
    } catch (e) {
      console.log('schema error', e.message);
      response_list = { error: e };
    }
    return response_list;
  }

  //schema template Create
  async schemaTemplateCreate(postrequest) {
    const url = `${process.env.SCHEMA_URL}/template`;
    var data = JSON.stringify(postrequest);
    var config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    let response_list = null;
    try {
      const observable = this.httpService.post(url, data, config);

      const promise = observable.toPromise();

      const response = await promise;
      response_list = response.data;
      //console.log(response.data);
    } catch (e) {
      console.log('schema template error', e.message);
      response_list = { error: e };
    }
    return response_list;
  }

  //schema template list
  async schemaTemplateList(schemaid) {
    const url = `${process.env.SCHEMA_URL}/template?schemaId=${schemaid}`;
    let response_list = null;
    try {
      const observable = this.httpService.get(url);

      const promise = observable.toPromise();

      const response = await promise;
      response_list = response.data;
      //console.log(response.data);
    } catch (e) {
      console.log('schema error', e.message);
      response_list = { error: e };
    }
    return response_list;
  }

  //generate schema
  async generateSchema(schemaId) {
    const url = `${process.env.SCHEMA_URL}/credential-schema/${schemaId}`;

    try {
      const observable = this.httpService.get(url);

      const promise = observable.toPromise();

      const response = await promise;

      return response.data[0]?.schema;
    } catch (e) {
      console.log('schema error', e.message);
    }
  }

  //generate did
  async generateDid(studentId) {
    const data = JSON.stringify({
      content: [
        {
          alsoKnownAs: [`did.${studentId}`],
          services: [
            {
              id: 'IdentityHub',
              type: 'IdentityHub',
              serviceEndpoint: {
                '@context': 'schema.identity.foundation/hub',
                '@type': 'UserServiceEndpoint',
                instance: ['did:test:hub.id'],
              },
            },
          ],
        },
      ],
    });

    const url = `${process.env.DID_URL}/did/generate`;

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    try {
      const observable = this.httpService.post(url, data, config);

      const promise = observable.toPromise();

      const response = await promise;
      //console.log('generateDid 67', response.data);
      return response.data;
    } catch (e) {
      console.log('did error', e.message);
    }
  }

  //issue credentials
  async issueCredentials(payload) {
    var data = JSON.stringify({
      credential: {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1',
        ],
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: `${payload.issuerId}`,
        issuanceDate: payload.issuanceDate,
        expirationDate: payload.expirationDate,
        credentialSubject: payload.credentialSubject,
        options: {
          created: '2020-04-02T18:48:36Z',
          credentialStatus: {
            type: 'RevocationList2020Status',
          },
        },
      },
      credentialSchemaId: payload.credSchema.id,
      credentialSchemaVersion: payload.credSchema.version,
      tags: ['tag1', 'tag2', 'tag3'],
    });
    const url = `${process.env.CRED_URL}/credentials/issue`;

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    try {
      const observable = this.httpService.post(url, data, config);

      const promise = observable.toPromise();

      const response = await promise;

      return response.data;
    } catch (e) {
      console.log('cred error', e.message);
    }
  }

  //issueCredentialsEL
  async issueCredentialsEL(payload) {
    var data = JSON.stringify({
      credential: {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1',
        ],
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: `${payload.issuerId}`,
        issuanceDate: payload.issuanceDate,
        expirationDate: payload.expirationDate,
        credentialSubject: payload.credentialSubject,
        options: {
          created: '2020-04-02T18:48:36Z',
          credentialStatus: {
            type: 'RevocationList2020Status',
          },
        },
      },
      credentialSchemaId: payload.credSchema.id,
      credentialSchemaVersion: payload.credSchema.version,
      tags: ['tag1', 'tag2', 'tag3'],
    });
    const url = `${process.env.CRED_URL}/credentials/issue`;

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };
    try {
      const observable = this.httpService.post(url, data, config);

      const promise = observable.toPromise();

      const response = await promise;

      return response.data;
    } catch (e) {
      return { error: e };
    }
  }

  // cred search
  async credSearch(sb_rc_search) {
    console.log('sb_rc_search', sb_rc_search);

    let data = JSON.stringify({
      subject: {
        id: sb_rc_search[0]?.did ? sb_rc_search[0].did : '',
      },
    });
    // let data = JSON.stringify({
    //   subjectId: sb_rc_search[0]?.did ? sb_rc_search[0].did : '',
    // });

    const url = process.env.CRED_URL + '/credentials/search';

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };
    let cred_search = null;
    try {
      const observable = this.httpService.post(url, data, config);
      const promise = observable.toPromise();
      const response = await promise;
      //console.log(JSON.stringify(response.data));
      cred_search = response.data;
    } catch (e) {
      //console.log(e);
      cred_search = { error: e };
    }
    return cred_search;
  }
  //custom
  //credSearchFilter
  async credSearchFilter(subjectFilter: any) {
    let data = JSON.stringify({
      subject: subjectFilter,
    });

    const url = process.env.CRED_URL + '/credentials/search';

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };
    let cred_search = null;
    try {
      const observable = this.httpService.post(url, data, config);
      const promise = observable.toPromise();
      const response = await promise;
      //console.log(JSON.stringify(response.data));
      cred_search = response.data;
    } catch (e) {
      //console.log(e);
      cred_search = { error: e };
    }

    return cred_search;
  }
}
