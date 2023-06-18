import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { Response } from 'express';
import { CredentialsService } from 'src/services/credentials/credentials.service';
import { SbrcService } from 'src/services/sbrc/sbrc.service';
import { TelemetryService } from 'src/services/telemetry/telemetry.service';
import { KeycloakService } from 'src/services/keycloak/keycloak.service';
import jwt_decode from 'jwt-decode';
const { Readable } = require('stream');

@Injectable()
export class BulkIssuanceService {
  constructor(
    private credService: CredentialsService,
    private sbrcService: SbrcService,
    private telemetryService: TelemetryService,
    private keycloakService: KeycloakService,
    private readonly httpService: HttpService,
  ) {}

  fs = require('fs');
  parse = require('csv-parse');
  async = require('async');
  papa = require('papaparse');

  //getToken
  async getToken(username: string, password: string, response: Response) {
    let qs = require('qs');
    if (username && password) {
      let data = qs.stringify({
        client_id: 'registry-frontend',
        username: username,
        password: password,
        grant_type: 'password',
      });
      const url =
        process.env.KEYCLOAK_URL +
        'realms/sunbird-rc/protocol/openid-connect/token';
      const config: AxiosRequestConfig = {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      };
      let keycloak_response = null;
      try {
        const observable = this.httpService.post(url, data, config);
        const promise = observable.toPromise();
        const response = await promise;
        //console.log(JSON.stringify(response.data));
        keycloak_response = response.data;
      } catch (e) {
        //console.log(e);
        //keycloak_response = { error: e };
      }
      if (keycloak_response == null) {
        return response.status(400).send({
          success: false,
          status: 'keycloak_error',
          message: 'Error in Authentication',
          result: null,
        });
      } else {
        return response.status(200).send({
          success: true,
          status: 'request_success',
          message: 'Success',
          result: keycloak_response?.access_token
            ? keycloak_response.access_token
            : '',
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getDID
  async getDID(uniquetext: string, response: Response) {
    if (uniquetext) {
      const generateddid = await this.credService.generateDid(uniquetext);
      if (generateddid?.error) {
        return response.status(400).send({
          success: false,
          status: 'did_generate_error',
          message: 'Identity Generation Failed ! Please Try Again.',
          result: generateddid?.error,
        });
      } else {
        var did = generateddid[0].verificationMethod[0].controller;
        return response.status(200).send({
          success: true,
          status: 'did_success',
          message: 'DID Success',
          result: did,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getIssuerRegister
  async getIssuerRegister(
    token: string,
    name: string,
    email: string,
    mobile: string,
    userid: string,
    response: Response,
  ) {
    if (token && name && email && mobile && userid) {
      let jwt_decode = await this.parseJwt(token);
      let roles = jwt_decode?.realm_access?.roles
        ? jwt_decode.realm_access.roles
        : [];
      //check admin roles in jwt
      if (roles.includes('admin')) {
        //check keycloak token
        const tokenUsername = await this.keycloakService.verifyUserToken(token);
        if (tokenUsername?.error) {
          return response.status(401).send({
            success: false,
            status: 'keycloak_token_bad_request',
            message: 'You do not have access for this request.',
            result: null,
          });
        } else if (!tokenUsername?.preferred_username) {
          return response.status(400).send({
            success: false,
            status: 'keycloak_token_error',
            message: 'Your Login Session Expired.',
            result: null,
          });
        } else {
          let data = JSON.stringify({
            name: name,
            email: email,
            mobile: mobile,
            userid: userid,
          });
          const url = process.env.REGISTRY_URL + 'api/v1/Issuer/invite';
          const config: AxiosRequestConfig = {
            headers: {
              'content-type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
          };
          var sb_rc_response_text = null;
          try {
            const observable = this.httpService.post(url, data, config);
            const promise = observable.toPromise();
            const response = await promise;
            //console.log(JSON.stringify(response.data));
            sb_rc_response_text = response.data;
          } catch (e) {
            //console.log(e);
            sb_rc_response_text = { error: e };
          }
          if (sb_rc_response_text?.error) {
            return response.status(400).send({
              success: false,
              status: 'sb_rc_register_error',
              message: 'System Register Error ! Please try again.',
              result: sb_rc_response_text?.error,
            });
          } else if (sb_rc_response_text?.params?.status === 'SUCCESSFUL') {
            return response.status(200).send({
              success: true,
              status: 'issuer_register',
              message: 'Issuer Registered',
              result: sb_rc_response_text,
            });
          } else {
            return response.status(400).send({
              success: false,
              status: 'sb_rc_register_duplicate',
              message: 'Duplicate Data Found.',
              result: sb_rc_response_text,
            });
          }
        }
      } else {
        return response.status(400).send({
          success: false,
          status: 'invalid_request',
          message: 'Invalid Keycloak Token',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getUploadFiles
  async getUploadFiles(
    token: string,
    type: string,
    issuerDetail: any,
    vcData: any,
    credentialSubjectCommon: any,
    csvfile: Express.Multer.File,
    response: Response,
  ) {
    if (token && issuerDetail && vcData && credentialSubjectCommon && csvfile) {
      let jwt_decode = await this.parseJwt(token);
      let roles = jwt_decode?.realm_access?.roles
        ? jwt_decode.realm_access.roles
        : [];
      //check Issuer roles in jwt
      if (roles.includes('Issuer')) {
        //check keycloak token
        const tokenUsername = await this.keycloakService.verifyUserToken(token);
        if (tokenUsername?.error) {
          return response.status(401).send({
            success: false,
            status: 'keycloak_token_bad_request',
            message: 'You do not have access for this request.',
            result: null,
          });
        } else if (!tokenUsername?.preferred_username) {
          return response.status(400).send({
            success: false,
            status: 'keycloak_token_error',
            message: 'Your Login Session Expired.',
            result: null,
          });
        } else {
          let issuerDetail_json = null;
          let vcData_json = null;
          let credentialSubjectCommon_json = null;
          try {
            issuerDetail_json = JSON.parse(issuerDetail);
            vcData_json = JSON.parse(vcData);
            credentialSubjectCommon_json = JSON.parse(credentialSubjectCommon);
          } catch (e) {
            issuerDetail_json = issuerDetail;
            vcData_json = vcData;
            credentialSubjectCommon_json = credentialSubjectCommon;
          }
          console.log('issuerDetail_json', issuerDetail_json);
          let schemaId = '';
          if (type === 'proofOfAssessment') {
            schemaId = process.env.PROOF_OF_ASSESSMENT;
          }
          if (type === 'proofOfEnrollment') {
            schemaId = process.env.PROOF_OF_ENROLLMENT;
          }
          if (type === 'proofOfBenifits') {
            schemaId = process.env.PROOF_OF_BENIFIT;
          }
          const stream = Readable.from(csvfile.buffer);
          let payload_data = new Object();
          payload_data['issuerDetail'] = issuerDetail_json;
          payload_data['vcData'] = vcData_json;
          payload_data['credentialSubjectCommon'] =
            credentialSubjectCommon_json;
          let csv_data = [];
          let csv_row_index = 0;
          let isvalidcsv = true;
          await new Promise<any>(async (done) => {
            await this.papa.parse(stream, {
              header: false,
              worker: true,
              delimiter: ',',
              step: function (row) {
                if (csv_row_index === 0) {
                } else if (isvalidcsv) {
                  if (type === 'proofOfEnrollment') {
                    csv_data.push({
                      username: row.data[0],
                      student_name: row.data[1],
                      email: row.data[2],
                      contact: row.data[3],
                      student_id: row.data[4],
                      reference_id: row.data[5],
                      guardian_name: row.data[6],
                      enrolled_on: row.data[7],
                      aadhar_token: row.data[8],
                      dob: row.data[9],
                    });
                  }
                  if (type === 'proofOfAssessment') {
                    csv_data.push({
                      username: row.data[0],
                      student_name: row.data[1],
                      email: row.data[2],
                      contact: row.data[3],
                      dob: row.data[4],
                      student_id: row.data[5],
                      reference_id: row.data[6],
                      aadhar_token: row.data[7],
                      marks: row.data[8],
                    });
                  }
                  //console.log('Row: ', row.data);
                }
                csv_row_index++;
              },
              complete: function () {
                //console.log('Loaded Node Data!');
                done(csv_data);
              },
            });
          });
          payload_data['credentialSubject'] = csv_data;
          //register and issue credentials
          await this.bulkRegisterCredentials(
            type,
            payload_data,
            schemaId,
            response,
          );
          //console.log(csv_data);
          /*return response.status(200).send({
            success: true,
            status: 'file_receive',
            message: 'File Received',
            result: payload_data,
          });*/
        }
      } else {
        return response.status(400).send({
          success: false,
          status: 'invalid_request',
          message: 'Invalid Keycloak Token',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //bulk register and credentials issue
  async bulkRegisterCredentials(
    type: string,
    payload_data: any,
    schemaId: string,
    response: Response,
  ) {
    if (type && payload_data && schemaId) {
      //register bulk student
      var issuerId = payload_data.issuerDetail.did;
      //generate schema
      var schemaRes = await this.credService.generateSchema(schemaId);
      //console.log('schemaRes', schemaRes);
      if (schemaRes) {
        //error log report
        let iserror = false;
        let loglist = [];
        let error_count = 0;
        let success_count = 0;
        let i_count = 0;

        var responseArray = [];

        // bulk import
        for (const iterator of payload_data.credentialSubject) {
          loglist[i_count] = {};
          loglist[i_count].studentDetails = iterator;

          try {
            if (payload_data.credentialSubjectCommon.grade) {
              iterator.grade = payload_data.credentialSubjectCommon.grade;
            }
            if (payload_data.credentialSubjectCommon.academic_year) {
              iterator.academic_year =
                payload_data.credentialSubjectCommon.academic_year;
            }
            if (payload_data.credentialSubjectCommon.benefitProvider) {
              iterator.benefitProvider =
                payload_data.credentialSubjectCommon.benefitProvider;
            }
            if (payload_data.credentialSubjectCommon.schemeName) {
              iterator.schemeName =
                payload_data.credentialSubjectCommon.schemeName;
            }
            if (payload_data.credentialSubjectCommon.schemeId) {
              iterator.schemeId = payload_data.credentialSubjectCommon.schemeId;
            }
            if (payload_data.credentialSubjectCommon.assessment) {
              iterator.assessment =
                payload_data.credentialSubjectCommon.assessment;
            }
            if (payload_data.credentialSubjectCommon.quarterlyAssessment) {
              iterator.quarterlyAssessment =
                payload_data.credentialSubjectCommon.quarterlyAssessment;
            }
            if (payload_data.credentialSubjectCommon.total) {
              iterator.total = payload_data.credentialSubjectCommon.total;
            }
            //list of schema update fields
            if (payload_data.issuerDetail.schoolName) {
              iterator.school_name = payload_data.issuerDetail.schoolName;
            }
            if (payload_data.issuerDetail.schoolid) {
              iterator.school_id = payload_data.issuerDetail.schoolid;
            }

            // find student
            let username = iterator.username;
            let searchSchema = {
              filters: {
                username: {
                  eq: username,
                },
              },
            };
            const studentDetails = await this.sbrcService.sbrcSearch(
              searchSchema,
              'Learner',
            );
            //console.log('studentDetails', studentDetails);
            if (studentDetails.length > 0) {
              if (studentDetails[0]?.did) {
                iterator.id = studentDetails[0].did;
                let obj = {
                  issuerId: issuerId,
                  credSchema: schemaRes,
                  credentialSubject: iterator,
                  issuanceDate: payload_data.vcData.issuanceDate,
                  expirationDate: payload_data.vcData.expirationDate,
                };
                //console.log('obj', obj);

                const cred = await this.credService.issueCredentials(obj);
                //console.log("cred 34", cred)
                if (cred) {
                  responseArray.push(cred);
                  loglist[i_count].status = true;
                  loglist[i_count].error = {};
                  success_count++;
                } else {
                  responseArray.push({
                    error: 'unable to issue credentials!',
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'Unable to Issue Credentials ! Please Try Again.';
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              } else {
                let didRes = await this.credService.generateDid(username);

                if (didRes) {
                  iterator.id = didRes[0].verificationMethod[0].controller;
                  let updateRes = await this.sbrcService.sbrcUpdate(
                    { did: iterator.id },
                    'Learner',
                    studentDetails[0].osid,
                  );
                  if (updateRes) {
                    let obj = {
                      issuerId: issuerId,
                      credSchema: schemaRes,
                      credentialSubject: iterator,
                      issuanceDate: payload_data.vcData.issuanceDate,
                      expirationDate: payload_data.vcData.expirationDate,
                    };
                    //console.log('obj', obj);

                    if (iterator.id) {
                      const cred = await this.credService.issueCredentials(obj);
                      //console.log("cred 34", cred)
                      if (cred) {
                        responseArray.push(cred);
                        loglist[i_count].status = true;
                        loglist[i_count].error = {};
                        success_count++;
                      } else {
                        responseArray.push({
                          error: 'unable to issue credentials!',
                        });
                        iserror = true;
                        loglist[i_count].status = false;
                        loglist[i_count].error =
                          'Unable to Issue Credentials ! Please Try Again.';
                        //loglist[i_count].errorlog = {};
                        error_count++;
                      }
                    }
                  } else {
                    responseArray.push({
                      error: 'unable to update did inside RC!',
                    });
                    iserror = true;
                    loglist[i_count].status = false;
                    loglist[i_count].error =
                      'Unable to Update Student Identity ! Please Try Again.';
                    //loglist[i_count].errorlog = {};
                    error_count++;
                  }
                } else {
                  responseArray.push({
                    error: 'unable to generate student did!',
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'Unable to Generate Student DID ! Please Try Again.';
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              }
            } else {
              let didRes = await this.credService.generateDid(username);

              if (didRes) {
                iterator.id = didRes[0].verificationMethod[0].controller;
                let inviteSchema = {
                  name: iterator.name,
                  did: iterator.id,
                  username: iterator.username,
                  email: iterator.email,
                  contact: iterator.contact,
                };
                //console.log('inviteSchema', inviteSchema);
                let createStudent = await this.sbrcService.sbrcInvite(
                  inviteSchema,
                  'Learner',
                );
                //console.log('createStudent', createStudent);

                if (createStudent) {
                  let obj = {
                    issuerId: issuerId,
                    credSchema: schemaRes,
                    credentialSubject: iterator,
                    issuanceDate: payload_data.vcData.issuanceDate,
                    expirationDate: payload_data.vcData.expirationDate,
                  };
                  //console.log('obj', obj);

                  const cred = await this.credService.issueCredentials(obj);
                  //console.log("cred 34", cred)
                  if (cred) {
                    responseArray.push(cred);
                    loglist[i_count].status = true;
                    loglist[i_count].error = {};
                    success_count++;
                  } else {
                    responseArray.push({
                      error: 'unable to issue credentials!',
                    });
                    iserror = true;
                    loglist[i_count].status = false;
                    loglist[i_count].error =
                      'Unable to Issue Credentials ! Please Try Again.';
                    //loglist[i_count].errorlog = {};
                    error_count++;
                  }
                } else {
                  responseArray.push({
                    error: 'unable to create student in RC!',
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'Unable to Create Student Account ! Please Try Again.';
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              } else {
                responseArray.push({
                  error: 'unable to generate student did!',
                });
                iserror = true;
                loglist[i_count].status = false;
                loglist[i_count].error =
                  'Unable to Generate Student DID ! Please Try Again.';
                //loglist[i_count].errorlog = {};
                error_count++;
              }
            }
          } catch (e) {
            //console.log(e);
            iserror = true;
            loglist[i_count].status = false;
            loglist[i_count].error = 'System Exception ! Please Try Again.';
            loglist[i_count].errorlog = JSON.stringify(e);
            error_count++;
          }
          i_count++;
        }
        return response.status(200).send({
          success: true,
          status: 'student_bulk_upload_api_success',
          iserror: iserror,
          message: 'Student Bulk Upload API Success.',
          error_count: error_count,
          success_count: success_count,
          result: loglist,
        });
      } else {
        return response.status(200).send({
          success: false,
          status: 'did_cred_generate_error',
          message:
            'User Identity and Credentials Generation Failed. Try Again.',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //helper function
  //get jwt token information
  parseJwt = async (token): Promise<any> => {
    if (!token) {
      return {};
    }
    const decoded = jwt_decode(token);
    return decoded;
  };
}
